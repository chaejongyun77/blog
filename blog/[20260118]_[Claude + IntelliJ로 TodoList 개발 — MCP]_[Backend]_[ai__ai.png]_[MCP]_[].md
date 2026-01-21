# Claude Code + MCP 실험기

요즘 개발자들 사이에서 Claude Code 이야기가 자주 보이기 시작했고 AI가 코드를 대신 작성해주는 것 뿐만 아니라 IDE 안에서 같이 개발할 수 있다는 점이 흥미롭게 들렸습니다.

마침 제가 주로 사용하는 IntelliJ와 연동할 수 있었고 요즘 많이 언급되고 있는 MCP도 직접 써보면서 경험을 쌓고 싶었습니다.

그래서 큰 서비스나 복잡한 구조가 아닌 단순한 프로젝트를 만들어 보려고 합니다.

- 프론트엔드: Thymeleaf + HTML
- 백엔드: Spring Boot + Kotlin + JPA
- DB: H2


이 조합으로 간단한 ToDoList 페이지를 구현하면서 Claude Code를 실제 개발 흐름 속에서 사용해보고 MCP가 어떤 역할을 하는지도 함께 살펴보겠습니다.

# MCP 개념 설명

## LLM & Agent
MCP를 이해하려면 먼저 LLM과 Agent에 대해서 이해해야 한다.

[
claude
](./img/mcp/mcp1.png)

LLM (Large Language Model)은 기본적으로 학습 당시에 습득된 지식을 통해서, 질문에 대해서 답변을 한다. 즉 학습되지 않은 정보에 대해서는 답변을 할 수 없고, 질문에 대한 답변 이외에 음악을 튼다가나, 컴퓨터내에서 파일을 검색한다던가의 추가적인 행동을 할 수 없다.
이러한 LLM의 한계를 극복하고 LLM 애플리케이션의 기능을 확장하기 위해서 우리는 LLM이 다른 애플리케이션이나 데이터 소스와 상호 작용을 하도록 할 수 있다.

예를 들어서, 이번달의 대학 입시 정보가 필요하면 구글 검색 엔진을 통해서 최신 자료를 검색하여, 그 자료를 기반으로 답변을 하도록 하거나, 현재의 주가 정보를 알고 싶으면 Yahoo Finance 웹사이트를 통해서, 주가 정보를 얻어오도록 할 수 있다. 
이렇게 LLM과 연동되는 외부 애플리케이션이나 데이터 소스를 Tool이라고 한다. 
그런데, Tool이 많을 경우 LLM은 주어진 문제에 대해서 어떤 Tool을 사용해야할지 생각을 하고 의사 결정을 해야 하는데, 이렇게 어떤 Tool을 사용할지 결정하고, Tool에서 얻은 정보를 통해서 답변을 만들어내는 역할을 하는 것이 바로 Agent 이다.

## MCP 프로토콜의 동작 원리
MCP에 대해서 정확하게 이해하려면, MCP는 정확하게 이야기 하면 Protocol이다. JSON-RPC/HTTP 를 이용하는 LLM 애플리케이션과 Tool 서버가 어떻게 통신하는지를 정의한 규약이다.
이 말은 이 규약만 따르면 어떤 SDK나 어떤 프로그래밍 언어등 사용할 수 있다는 것이다.

[
claude
](./img/mcp/mcp2.png)

한번 MCP가 어떻게 동작하는지 단계별로 예시 상황을 살펴보겠습니다.

#### STEP1. 사용자의 요청
사용자는 Claude Code에게 "게시글 작성로직에서 오류가 있는데 수정해줘"라고 요청합니다.

#### STEP2. LLM + Agent 판단
Claude Code 내부에서 LLM은 내부적으로 코드 확인 및 파일을 탐색하기 위해 IDE의 도움이 필요하다고 판단합니다.

#### STEP3. MCP Client가 프로토콜 요청 생성
Agent의 판단에 따라 Claude Code는 MCP Client 역할로 전환되어 다음과 같은 구조화된 요청(JSON-RPC) 을 생성합니다.

```java
{
  "jsonrpc": "2.0",
  "method": "readFile",
  "params": {
    "path": "notice/NoticeMapper.xml"
  },
  "id": 1
}
```

#### STEP4. MCP Server(IntelliJ)가 요청 처리
IntelliJ에 설치된 MCP Server 플러그인은 요청을 수신하고 IntelliJ 내부 API를 사용해 실제 파일을 읽습니다. 그리고 그 결과를 다시 MCP 규약에 맞게 응답합니다.

```java
{
  "jsonrpc": "2.0",
  "result": {
    "content": "<select id=...>...</select>"
  },
  "id": 1
}
```
#### STEP5. LLM 재분석 및 수정 판단
Claude LLM은 전달받은 실제 코드 내용을 기반으로 문제점을 판단하고 수정이 필요하다고 결정합니다.

#### STEP6. MCP Client를 통한 수정 요청
통신규약에 맞게 파일 수정을 요청합니다.

```java
{
  "jsonrpc": "2.0",
  "method": "updateFile",
  "params": {
    "path": "board/boardMapper.xml",
    "diff": "...."
  },
  "id": 2
}
```

#### STEP7. IntelliJ가 실제 파일 수정
MCP Server는 이 요청을 받아 IntelliJ를 통해 실제 프로젝트 파일을 수정합니다.

# IntelliJ + Claude Code 연동 과정

## IntelliJ MCP Server 플러그인 설치

[
claude
](./img/mcp/mcp3.png)

## Claude 연동

[
claude
](./img/mcp/mcp4.png)

구성편집을 눌러 claude_desktop_config.json 파일을 아래와 같이 수정합니다.

```java
{
  "mcpServers": {
    "jetbrains": {
      "command": "npx.cmd",
      "args": ["-y", "@jetbrains/mcp-proxy"]
    }
  }
}
```

## 연동 확인


[
claude
](./img/mcp/mcp1.png)

# 실제로 ToDoList를 어떻게 만들었는지 흐름 정리

# 마무리하여