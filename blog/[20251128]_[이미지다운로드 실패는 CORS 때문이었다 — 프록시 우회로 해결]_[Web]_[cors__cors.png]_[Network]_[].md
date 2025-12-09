# 문제 상황과 진행 배경
> "이미지로 다운로드가 왜 안되지?"

사용자가 현재 보고 있는 화면을 그대로 이미지로 저장하기 위해
html2canvas와 toBlob()을 사용해 DOM 전체를 캡처하는 기능을 구현했습니다.
기능 자체는 복잡하지 않았지만 실제로 다운로드를 실행했을 때 이미지 생성이 되지 않는 문제가 발생했습니다.

브라우저 개발자 도구에서 로그를 확인해보니
여러 이미지 리소스 로딩 시 **CORS origin** 오류가 발생하고 있었습니다.
정확히는 DOM 캡처 과정에서 일부 이미지가 정상적으로 로딩되지 않아 캔버스가 생성되지 않았습니다.

이 포스팅에서는 해당 문제가 왜 발생했는지
그리고 어떻게 해결했는지 정리해보려 합니다.

***
<br>

# CORS Origin은 무엇인가?
<strong>CORS(Cross-Origin Resource Sharing)</strong>는
브라우저가 보안상의 이유로 다른 출처(origin) 에 있는 리소스에 접근할 때
그 요청을 허용할지 판단하는 규칙입니다.

출처는 다음 **세 요소**로 구성됩니다.

- 프로토콜 (https/http)
- 도메인 (clboard.co.kr)
- 포트(80, 443)
  

### 같은 출처(Same-Origin) 예시

| URL | 이유 |
|-----|----|
|https://clboard.com/page  |기준 URL이 https://clboard.com 일 때 완전히 동일 |
|https://clboard.com/detail?id=1|Path, Query는 달라도 origin 영향 없음|
|https://clboard.com:443/profile| HTTPS 기본 포트 443|

<br>

### 다른 출처(Cross-Origin) 예시
1. ***프로토콜이 다른 경우***  


| URL | 차이|
|-----|-----|
|http://clboard.com  | 프로토콜: http → 다른 출처 |
|https://clboard.com| 프로토콜: https     |

2. ***도메인이 다른 경우***


| URL | 차이|
|-----|-----|
|https://api.clboard.com | 서브도메인이 달라짐 → 다른 출처 |
|https://cdn.clboard.com|     |

3. ***포트가 다른 경우***


| URL                      | 차이|
|--------------------------|-----|
| https://clboard.com:5173 | 포트 다름 → 다른 출처 |
| https://clboard.com:8080 |      |

즉, 브라우저는 다른 출처의 이미지나 스크립트를 불러올 때 
그 리소스 서버가 명시적으로 접근을 허용하지 않으면 요청을 차단합니다.
  
***  
  

# 이렇게 해결 해 나갔습니다.
<br>

## 첫 번째 시도 : CDN 리소스에 CORS헤더추가
> cors 허용헤더를 추가해주자!

우리 서비스 CDN에 저장된 리소스들은
**서버 측에서 응답 헤더에 CORS 허용을 추가**하여 문제를 해결할 수 있었습니다.
```aiignore
Access-Control-Allow-Origin: *
```

이렇게 하면 html2canvas가 CDN 이미지를 가져와도 캔버스가 오염되지 않았습니다.

하지만 문제는 제가 관리할 수 없는 <strong>외부 도메인</strong>의 이미지였습니다.
해당 서버의 CORS 정책에 접근할 수 없기 때문에
어떠한 설정도 적용할 수 없었습니다.

이 경우 html2canvas는 계속해서 오류를 발생시켰습니다.

<br>

## 두 번째 시도 : 백엔드 프록시를 통한 동일 출처화 처리
> 외부가 아닌 우리 서버에서 온 것!

방향을 다음과 같이 잡았습니다.
1. 프론트에서 외부 이미지를 직접 로딩하지 않는다.
2. 백엔드 서버가 외부 이미지 URL에 대신 요청을 보내 데이터를 가져온다.
3. 해당 바이너리를 그대로 프론트에 전달한다.
4.  프론트는 이를 **우리 서버에서 보낸 이미지**로 사용한다.

이 방식에서는 브라우저가 보기에  이미지가 **외부가 아닌 우리 서버에서 온 것**으로 간주됩니다.
결과적으로 캔버스가 오염되지 않고 이미지 다운로드가 정상적으로 작동합니다.

#### 구현코드
```aiignore
    @ResponseBody
    @GetMapping("/convert/url/canvas")
    fun convertUrlToCanvas(@RequestParam url: String): ResponseEntity<ByteArray> {
        return try {
            val decodedUrl = URL(URLDecoder.decode(url, StandardCharsets.UTF_8.toString()))
            val connection = decodedUrl.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"

            connection.inputStream.use { inputStream ->
                if (connection.responseCode == 200) {
                    ResponseEntity(IOUtils.toByteArray(inputStream), HttpStatus.OK)
                } else {
                    log.error("Response Code: ${connection.responseCode}")
                    ResponseEntity("Invalid response".toByteArray(StandardCharsets.UTF_8), HttpStatus.BAD_REQUEST)
                }
            }
        } catch (e: MalformedURLException) {
            log.error("Malformed URL: $url", e)
            ResponseEntity("Malformed URL".toByteArray(StandardCharsets.UTF_8), HttpStatus.BAD_REQUEST)
        } catch (e: Exception) {
            log.error("URL을 가져오는 동안 에러 발생: $url", e)
            ResponseEntity("Internal Server Error".toByteArray(StandardCharsets.UTF_8), HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }
```
- url 쿼리 파라미터로 외부 이미지 URL을 문자열로 
- 반환 타입은 실제 이미지 byte 배열을 그대로 반환
- decodedUrl은 인코딩 한것을 디코딩 한 외부 이미지 URL
- 그 후 서버 쪽에서 <strong>직접</strong> 외부 URL로 HTTP 연결 (브라우저가 요청하는게 아니라 우리 백엔드 서버가 요청)
- 따라서 CORS는 <strong>브라우저 보안 정책</strong>이라 이 단계에서는 관여 X
- 외부 서버가 200을 반환하면 그 응답 바디를 inputSteam으로 읽고 byte[]로 반환
- 결국에는 브라우저가 이 바이트 데이터를 우리 서버가 보냇기 때문에 <strong>Same-Origin</strong> 리소스로 판단  

***
  
  

# 마무리하며
html2canvas는 편리한 라이브러리지만 브라우저의 CORS 정책과 맞물리면 예상치 못한 제약이 생길 수 있다는걸 알게되었습니다. 

그리고 이미지 다운로드할때뿐만 아니라 이미지를 표시하거나 렌더링하는 과정에서도 CORS 문제가 빈번하게 발생하여 난감한 경우가 많았는데 브라우저의 출처 정책을 이해하고 나니 문제를 구조적으로 바라볼 수 있었습니다.

이번 문제는 CDN 리소스는 서버 헤더 수정으로 해결 가능했지만 외부 사이트 리소스는 해당 서버의 정책을 바꿀 수 없기 때문에 백엔드 프록시를 통해 동일 출처로 변환하는 방식으로 해결했습니다.

결과적으로 외부 이미지가 포함된 페이지라도 문제없이 DOM 전체를 이미지로 변환할 수 있게 되었고 악명높은 CORS 에러를 해결할 수 있어서 뿌듯했습니다.

![
다운로드 성공
](./img/cors/download1.png)

![
다운로드 결과
](./img/cors/download2.png)
