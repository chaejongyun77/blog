# 진행 배경
> "JWT토큰을 활용하여 보안성을 높여보자"

기존 시스템에서는  
**세션 + JWT Access Token** 조합을 사용해 로그인 상태를 유지하고 있었다.

Access Token을 통해 사용자를 식별하되,
세션을 함께 사용하면서 서버 측에서도 로그인 상태를 관리하는 구조였다.

하지만 최근 여러 기업에서 발생한 개인정보 유출 사고와
인증·인가 취약점 이슈를 계기로,
로그인 보안 구조 전반을 다시 점검할 필요가 있다고 판단했다.

특히 세션 기반 상태 관리와
만료 제어가 어려운 Access Token 단독 사용 방식은
보안과 확장성 측면에서 한계가 명확했다.

이러한 문제를 개선하기 위해
기존 세션 구조를 제거하고,
**JWT Access Token + Refresh Token + Redis** 기반의
로그인 로직으로 인증 구조를 재설계했다.

***
<br>

# JWT토큰이란 무엇인가?
**JWT(Json Web Token)** 은 Json 객체에 인증에 필요한 정보들을 담은 후 **비밀키로 서명한 토큰**으로 인터넷 표준 인증 방식이다. 

<br>

## JWT토큰 프로세스

![
토큰
](./img/jwt/token3.png)

- 사용자가 아이디와 비밀번호를 입력하여 서버에 로그인 요청
- 서버는 비밀키를 사용해 JSON payload에 서명(Signature)을 추가한 JWT 토큰을 생성
- Response body로 JWT토큰 전달
- 이후 API요청시 헤더에 JWT 토큰을 포함
- 서버에서 JWT검증 후 API 요청 처리

## 현재 로그인 프로세스의 문제점 분석
>JWT토큰도 안전한게 아니다

1. Access Token만 사용하는 한계   

현재 로그인 구조에서는 **Access Token 하나만 발급하여 인증**을 처리하고 있습니다.   
보안을 위해 유효시간을 무제한으로 두지 않고 4시간으로 설정해두었지만 만약에 토큰이 탈취당할 경우 해당 유효시간 동안은 **누구든 API를 접근할 수 있다는 문제점**이 있었습니다.
또한 탈취를 당하더라도 서버쪽에서 토큰관련 정보를 저장해두지 않았기 때문에 강제로 로그아웃도 시킬 수 없는 상황이여서 보안에 취약했습니다.   
즉 Access Token 하나로 로그인 상태를 유지하는 구조는 보안적인 사고가 발생했을 시 대응할 수 있는 수단이 거의 없었습니다.

2. JWT Payload에 포함된 불필요한 사용자 정보   

JWT는 Response body를 통해 서버에서 클라이언트로 전달되며 이때 JWT의 Payload에는 다음과 같은 사용자 정보가 포함되어 있었습니다.
- 사용자 ID
- 닉네임
- 사용자 권한값
- 사용자 타입
- 접속일자
- 기타 사용자 정보등
   
따라서 만약 토큰이 유출될 경우 개인정보가 노출이 되고 내부 시스템의 구조를 유추할 수 있는 수단이 될 수도 있습니다.   
또한 이렇게 불필요한 사용자 정보를 Access Token에 저장하면 JWT 토큰의 크기가 증가하고 API 요청 시 쿠키가 자동으로 헤더에 포함되어 전송될때 크기 증가로 이한 트래픽 및 성능에 영향을 끼칠 수도 있을 거 같다는 생각을 했습니다.

3. Access Token을 쿠키에 Base64 형태로 저장   

Access Token 값을 쿠키에 Base64형태로 저장하다보니 누구나 개발자도구를 통해 Access Token 값을 찾아낸 후 디코딩을 할 수 있었습니다.   
물론 값을 한 눈에 알아보기 쉬운 형태는 아니었지만 마음먹고 토큰을 탈취하려고 하는 사람들에겐 디코딩하기 쉬운 값들이므로 보안에 취약점이 있었습니다.

<br>

***

## 그래서 보안에 어떻게 신경을 썻는가?
<br>

### RefreshToken을 사용한 인증 구조 개선

Access Token의 한계를 인지한 후 가장 먼저 적용한 개선 방법은 Refresh Token을 도입하는 것이었다.

#### Refresh Token이란?
Refresh Token은 Access Token이 만료되었을 때 새로운 Access Token을 재발급받기 위해 사용하는 토큰이다.

- Access Token 보다 긴 유효시간
- 인증 요청에는 사용되지 않음
- 오직 토큰 재발급 용도로만 사용

> Access Token이 **출입증**이라면 ReFresh Token은 출입증을 다시 받기위한 **신분증**

### 초기의 Refresh Token 도입 방식
처음에는 서버 상태에 대해 stateless 구조를 유지하고자 다음과 같은 방식으로 Refresh Token을 적용했습니다.

#### 초기 설계   
- Access Token 유효시간 15분
- Refresh Token 유효시간 4시간
- 두 토큰 다 클라이언트에 전달 후 쿠키에 저장

### 동작 방식    
1. Access Token 기간 만료
2. 클라이언트가 Refresh Token을 서버로 전달
3. 서버는 Refresh Token의 서명, 만료시간등을 검증
4. 검증 성공 시 새로운 Access Token 발급   

위와 같은 방식은 구현이 단순하고 서버에 별다른 저장소가 필요 없다는 장점이 있다.

### 그런데 여전히 남아있는 문제점
> 그러면 Refresh Token을 탈취당하면 어떻게 되는건데? 
> 결국 Access Token만을 사용할때랑 똑같이 위험한거 아니야?

JWT 토큰의 stateless 장점을 살릴려고 서버에서 관리를 안하려는거에 중점을 둿다가 결국 보안적 한계를 마주하게 되었습니다.

1. Refresh Token 탈취 시 재발급 무제한 허용
- 쿠키에 저장한 Refresh Token을 탈취당하면 결국 만료시간 까지 계속 Access Token 재발급이 가능해짐

2. 동시 로그인 및 제어 불가
- 동일 계정으로 다중 로그인을 했을 때 통제가 불가능함

3. 강제 로그아웃을 시킬 수 없음
- 서버가 Refresh Token을 기억하고 있지 않다보니간 특정 사용자를 로그아웃 시킬 수 있는 수단이 없음

4. 헤더 용량 증가
- 쿠키에 AccessToken과 RefreshToken 값을 저장하다보니 API전송할 때 헤더에 포함되는 쿠키 용량이 증가함

결국에는 Refresh Token을 도입했지만 토큰을 통제하지 못하다보니 제약이 걸리는게 많았고 보안에 취약한 점도 많았습니다.

### Redis에 Refresh Token을 저장하는 인증 구조로 변경
> 완전한 stateless 구조를 포기하다   

#### Redis + RefreshToken을 활용한 프로세스
<br>

![
refreshToken
](./img/jwt/token5.png)

- 로그인 요청 
- 로그인완료되면 서버에서 RefreshToken UUID를 키로 하고 refresh Token 값을 저장함과 동시에 Access Token과 Refresh Token UUID를 클라이언트에서 전달
- 클라이언트에서 Access Token은 Local Storage ,RefreshToken UUID는 쿠키에 저장 
- 클라이언트에서 서버로 api 호출 시 Access Token을 헤더에 담아서 전송 
- 백앤드는 Access Token 검증, Access Token이 만료되었으면 401에러 
- 만약 클라이언트가 401에러를 받으면 RefreshToken UUID로 서버에 토큰 갱신 요청 
- Redis에 저장된 Refresh Token 유효성 검증 및 토큰 페어링 검증 
- 검증 통과하면 서버에서 Access Token 재발급

1. Redis에 RefreshToken 저장   

![
refreshToken
](./img/jwt/token8.png)

- RefreshToken UUID를 key
- Refresh Token 값을 value로 저장   

<br> 

2. Local Storage에 Access Token 저장

![
refreshToken
](./img/jwt/token6.png)

3. 쿠키에 RefreshToken UUID 저장

![
refreshToken
](./img/jwt/token6.png)

4. Refresh Token 갱신 로직

#### 토큰 페어 검증을 위해 Claims 추출 

```java 
 val accessClaims = try {
            JwtUtil.getClaims(token)
        } catch (e: ExpiredJwtException) {
            
            e.claims
        } ?: throw ForbiddenException("INVALID_ACCESS_TOKEN")

```
- 토큰 페어 검증을 위해 AccessToken안에 들어있는 userId 추출

#### refreshTokenUUID에 해당하는 Refresh Token 유효성 검증

```java
   val savedRefreshToken = getRefreshToken(refreshTokenUUID, role)
            ?: throw ForbiddenException("REFRESH_TOKEN_NOT_FOUND")

        
        val refreshClaims = try {
            JwtUtil.isValidJwt(savedRefreshToken) 
            JwtUtil.getClaims(savedRefreshToken)  
        } catch (e: ExpiredJwtException) {
            throw ForbiddenException("REFRESH_TOKEN_EXPIRED")
        }
```
- Refresh Token이 만료되었는지, 변조되었는지 유효성을 판단

#### 토큰 페어 검증 

```java
        val refreshId: Long = when (role) {
            Role.선생님 -> {
                refreshClaims["아이디"]?.toString()?.toLongOrNull()
                    ?: throw ForbiddenException("id not found for TEACHER in refresh token")
            }

            Role.학생 -> {
                refreshClaims["학생아이디"]?.toString()?.toLongOrNull()
                    ?: throw ForbiddenException("studentId not found for STUDENT in refresh token")
            }

            else -> throw ForbiddenException("UNKNOWN_ROLE")
        }
        if (refreshId != accessId) {
            throw ForbiddenException("REFRESH_TOKEN_MISMATCH")
        }
        
```

- Access Token 안에 들어있는 userId와 Refresh Token안에 들어있는 userId가 같은지 체크
- Refresh Token이 지금 만료된 Access Token의 주인이 맞는지 확인


#### Access Token 재발급

```java
val newAccessToken = when (role) {
        Role.선생님 -> {
            val teacher = userMapper.selectUser(refreshId)
            JwtUtil.buildAccessJwt(TeacherResponse(teacher))
        }

        Role.학생 -> {
            val student: Student = studentRepository.findById(refreshId).orElseThrow()
            JwtUtil.buildAccessJwt(StudentResponse(student))
        }

        else -> throw ForbiddenException("UNKNOWN_ROLE")
    }

    return Token().apply {
        accessToken = newAccessToken
    }
```

## 여전히 문제점이 있다면?

1. Local Storage는 안전한가? Access Token의 유효시간이 아무리 짧더라도 해킹당하게 되면 그 시간동안은 보안이 위험한거 아닌가..?
2. Redis가 먹통이 되면 로그인이 안되는거 아니야?
3. AccessToken만 재발급할 뿐만 아니라 refreshToken도 재발급해서 redis에 저장이 필요


## 마무리하여

