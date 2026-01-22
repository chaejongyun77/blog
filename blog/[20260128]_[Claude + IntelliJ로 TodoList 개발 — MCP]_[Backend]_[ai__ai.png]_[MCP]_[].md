# Claude Code + MCP 실험기

요즘 개발자들 사이에서 Claude Code 얘기가 자주 들리기 시작했고 AI가 코드를 대신 작성해주는 것 뿐만 아니라 IDE 안에서 같이 개발할 수 있다는 점이 흥미롭게 들렸습니다.

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

## 1. 투두 리스트 CRUD 서버 개발 (Spring Boot + JPA + H2)
```
# 역할
너는 숙련된 백엔드 개발자야. 내가 요청한 기능에 맞게 Kotlin + Spring Boot 기반의 코드를 작성해줘.

# 기술 스택
Spring Boot 3.x, Spring Web, Spring Data JPA, H2DB

# 요구사항
1. Todo Entity는 title, description, isDone 필드를 갖는다.
2. title은 필수이며, description은 선택, isDone은 기본값 false.
3. 투두를 등록(Create), 전체 조회(Read), 단건 조회(Read), 수정(Update), 삭제(Delete)하는 REST API를 만들어줘.
4. 각 기능에 맞는 DTO, Service, Controller를 작성해줘.
5. Repository는 JpaRepository로 만들어줘.
6. 테스트 코드는 나중에 따로 요청할게.
```

## 2. Thymeleaf + HTML로 간단한 프론트엔드 개발
```
# 역할
너는 Spring Boot + Thymeleaf를 사용하는 웹 프론트엔드 개발자야.
기존 작성된 서버 코드를 바탕으로 Thymeleaf와 연동을 진행해주면 돼

# 요구사항
1. todo 목록을 보여주는 list.html을 만들어줘.
2. todo 등록 폼을 갖는 create.html을 만들어줘.
3. 등록 폼에는 title, description 입력창과 등록 버튼이 있어야 해.
4. 목록 페이지에서는 체크박스로 완료 처리(isDone 수정)가 가능해야 해.
5. Controller는 @Controller 애노테이션을 사용하고, Model에 데이터 넣어서 view에 전달해줘.
6. thymeleaf 문법은 기본적인 것만 사용해줘.
```

## 3. 세션기반 로그인/ 회원가입 개발
```
# 역할
너는 Spring Boot 백엔드 개발자야. 기존에 만든 투두 리스트 서버에 세션 기반 회원가입/로그인 기능을 연동할 거야.
로그인한 사용자만 자신의 투두 목록을 조회, 생성, 수정, 삭제할 수 있게 해줘.

# 현재 상황
- Todo 엔티티는 이미 존재하고, Todo CRUD 기능도 구현되어 있어.
- Thymeleaf 기반의 프론트엔드 (list.html, create.html) 도 구현되어 있어.

# 해야 할 일

## ✅ 회원 관련 기능 추가

1. User Entity 생성
   - email, password (BCrypt로 암호화), nickname 필드
   - email은 유일해야 해.

2. 회원가입 기능 (/signup)
   - Thymeleaf로 signup.html 폼 페이지
   - 중복 이메일은 등록 불가
   - 성공 시 /login으로 리다이렉트

3. 로그인 기능 (/login)
   - Thymeleaf login.html 폼 페이지
   - 로그인 성공 시 세션에 사용자 정보 저장
   - 실패 시 오류 메시지 표시

4. 로그아웃 기능 (/logout)
   - 세션 무효화 후 /login으로 이동

## ✅ 투두 기능과 사용자 연동

1. Todo 엔티티에 User (ManyToOne) 연관관계 추가
2. 로그인한 사용자만 자신의 투두를 조회/등록/수정/삭제 가능하게 수정
3. 투두 생성 시 현재 로그인한 사용자를 Todo의 주인으로 설정
4. 컨트롤러에서 세션을 통해 로그인 유저 정보를 가져오고, 해당 유저의 투두만 처리

## ✅ Thymeleaf 연동

- 로그인된 유저의 닉네임을 list.html에 출력해줘
- 로그인하지 않은 사용자가 /todos 등에 접근하면 /login으로 리다이렉트

## 결과

```
# 마무리하여