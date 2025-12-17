# 문제 상황과 진행 배경
> "게시물 로딩이 너무 느리다는데요?"

프로젝트 운영 과정에서 사용자가 특정 게시판에 진입할 때 화면 **로딩이 지나치게 오래걸린다**는 VOC가 들어온 적이 있었습니다.
특히 게시물이 많거나 게시물 안에 이미지와 같은 요소들이 첨부된 경우 증상이 심해졌고 사용자 입장에서는 페이지가 멈춘 것 같다고 느낄정도로 성능이 저하되는 상황이었습니다.

문제를 파악하기 위해 브라우저 **개발자도구의 네트워크 탭**에서 모든 API의 응답속도를 확인 해 어떤 API가 부하를 일으키고 있는지 확인하는 작업을 하였습니다.
그 결과, 게시물 목록을 불러오는 API가 **최대 6초**까지 걸리는 비정상적인 지연이 발생하고 있다는 점을 발견하였습니다.

원인이 무엇인지 추적하기 위해 해당 API에서 사용하는 DB 조회 쿼리를 분석하였는데 여기서  <span style="color:red"> **N+1 문제** </span>가 존재한다는 것을 확인할 수 있었습니다.

구체적으로는
- 게시물을 먼저 조회한 뒤
- 각 게시물에 포함된 이미지를 조회

즉, 게시물이 100개가 있고 그 안에 각각 이미지가 다 들어가있다고 가정하면
- 게시물 조회 -> 1번
- 이미지 조회 -> 100번

이런식으로 총 **101번의 쿼리**가 실행되는 비효율적인 구조를 가지고 있었습니다. 따라서 이러한 문제를 해결하기 위해 쿼리 구조를 개선하여 N+1 문제를
해결하는 작업을 진행하게 되었습니다.

***
<br>
<br>

# JPA의 N+1이란 무엇인가?
> 쿼리가 왜 추가적으로 발생하는걸까...

JPA의 N+1 문제는 연관관계가 있는 엔티티를 조회할 때 조회된 개수의 N개 만큼 추가적인 쿼리가 발생하는 문제입니다.
  
일단 어떠한 상황에서 JPA의 N+1문제가 발생하는지 상황을 알아보겠습니다.


![
Vote - VoteOption 엔티티 1:N 양방향 관계
](./img/backend/vote.png)
<div style="text-align: center;">Vote – VoteOption 엔티티 1:N 양방향 관계</div> 

#### 엔티티
- Vote 게시물 1, 2, 3 엔티티가 존재한다고 가정
- 각 Vote 게시물 안에는 VoteOptions(투표옵션)이 속해있는 상황

#### 비즈니스 요구 사항
- 각 Vote 게시물 안에 포함되어 있는 VoteOptions을 보여주세요

이러한 요구사항이 존재한다고 할 때 테스트코드로 한번 구현해보겠습니다.

## JPA N+1 테스트

#### 테스트코드
```java
    // ----- when: Vote 목록만 조회 (voteOptions는 아직 안 가져옴, LAZY) -----
        val votes = entityManager.createQuery(
            "SELECT v FROM tb_vote v",
            Vote::class.java
        ).resultList

        // ----- then: 여기서 voteOptions 접근하면서 Vote마다 추가 쿼리 발생 -----
        for (vote in votes) {
            val options = vote.voteOptions
            println("question=${vote.question}, options=${options.map { it.content }}")
        }
```

- 모든 Vote 목록을 조회
- 각 Vote에 해당하는 VoteOptions의 내용을 출력  
  
<br>

#### 테스트결과
![
Vote 게시물 조회 
](./img/backend/selectVote.png)

![
VoteOptions 조회
](./img/backend/voteOptions.png)

결과를 살펴보면 모든 Vote 게시물을 조회하는 쿼리 1개와 각 Vote 게시물에 포함된 VoteOptions 조회 쿼리가 여러번 실행되는 것을 확인할 수 있습니다.

- 모든 Vote 게시물 조회 : <span style="color:red">  1번 </span> 
- 각 Vote 게시물에 포함된 VoteOptions 조회 : <span style="color:red"> N번 </span> 

따라서 Vote 게시물에 포함된 VoteOptions이 더 많을 수록 **1+N 번만큼의 쿼리가 추가적으로 발생**하게 됩니다.

<br>

  
## N+1문제 원인 상세 분석
> 연관관계를 자동으로 처리하기 위해 사용하는 **지연로딩(LAZY) 전략**

JPA는 ORM 기술로
데이터베이스 테이블을 엔티티로 매핑하여 다루는 방식을 사용합니다.
개발자는 SQL을 직접 작성하는 대신 엔티티 객체와 연관관계를 통해 데이터를 조회하고 조작하게 됩니다.

문제는 이 과정에서 **JPA가 연관된 엔티티를 어떤 방식으로 로딩할 것인지를 결정**한다는 점입니다.
특히 **연관관계(@OneToMany, @ManyToOne 등)에 기본으로 설정되어 있는 지연로딩(LAZY)은 N+1 문제의 가장 대표적인 원인**입니다.

지연로딩은 “필요한 순간까지 연관 엔티티를 조회하지 않는다”는 전략입니다.
예를 들어 Vote 엔티티를 조회하면 JPA는 VoteOption 컬렉션을 바로 가져오지 않고
프록시 객체만 넣어둔 뒤 실제로 vote.voteOptions 에 접근하는 순간 별도의 SQL을 추가로 실행합니다.

이 방식은 여러개의 엔티티를 한 번에 조회하는 상황일때 쿼리가 엔티티 개수만큼 반복 실행되므로 성능 문제가 발생합니다.

***
<br>

## 그렇다면 왜 JPA는 이렇게 설계햇을까?
> 애초에 JOIN으로 한 번에 데이터를 가져오면
N+1 문제도 발생하지 않고 성능도 더 좋은 것 아닌가?

ORM이 지향하는 철학과 실제 데이터 사용패턴을 고려하면 자동 JOIN 전략이 오히려 더 큰 문제를 만들어내기 때문에 현재의 설계가 적용되었다고 합니다.

이러한 설계의 핵심이유를 알아보겠습니다.

**1. 자동으로 JOIN해서 가져오면 많은 양의 데이터를 조회할 가능성 多**
  
예를 들어 다음과 같은 엔티티 구조가 있다고 가정해봅시다.
```
Post 1 --- N Comment (댓글)
     1 --- N Image (이미지)
     1 --- N Tag (태그)
     1 --- N Like (좋아요)
```
하나의 포스트 안에 댓글과 이미지 그리고 태그와 좋아요가 있을때 만약 포스트 한개를 조회하게 된다면 어떻게 될까?

- Post 1개
- Comment 10개
- Image 5개
- Tag 3개   

<br>

Post 한 개를 조회하는데 관련된 테이블까지 전부 JOIN해서 가져오기 때문에 조회하면  1x10x5x3 = **150개의 row**를 조회하게 됩니다.

<br>

**2.객체 동일성을 보장해야한다.**

JPA는 같은 영속성 컨텍스트 안에서 Primary Key가 같으면 같은 엔티티 객체로 인식합니다.  
만약 동일한 Primary Key를 가진 엔티티가 서로 다른 객체로 존재한다면 어떤 문제가 발생할까요?
<br>
- 1차 캐시가 동작하지 않음
- 변경 감지(Dirty Checking)가 불가능
- 트랜잭션 범위 내에서 변경 사항을 추적할 수 없음
<br>
결국 이는 JPA가 제공하는 ORM 자체가 성립할 수 없다는 의미입니다.

그렇다면 왜 JPA는 동일한 Primary Key에 대해
하나의 객체만을 보장해야 할까요?

아래와 같은 상황을 가정해봅시다.

**Post 테이블**

| id | title |
|----|------|
| 1  | 공지사항 |

**Comment 테이블**

| id | post_id | content|
|----|---------|-----|
| 10 | 1       | "좋은 글이네요"|
| 11 | 1       |  "감사합니다" |

Post + Comment를 한번에 조회한다고 가정했을때 JOIN결과는 다음과 같습니다.
```
SELECT *
FROM post p
JOIN comment c ON c.post_id = p.id
WHERE p.id = 1;
```

| p.id | p.title   | c.id | c.content       |
|------|-----------|------|-----------------|
| 1    | 공지사항  | 10   | 좋은 글이네요   |
| 1    | 공지사항  | 11   | 감사합니다      |

여기서 문제는 JOIN 결과가 Post 1개가 아니라 2개의 row로 표시되기 때문에 만약 ORM이 JOIN결과를 보고 단순히 객체를 만든다면 
```java
val postA = Post(id = 1, title = "공지사항", comments = [...])
val postB = Post(id = 1, title = "공지사항", comments = [...])
```
위와 같이 Post 객체가 두개가 만들어져 **객체의 동일성**이 깨져버리는 현상이 나타납니다.  
따라서 JPA는 JOIN 결과를 그대로 객체로 생성하지 않고
영속성 컨텍스트를 기준으로 Primary Key 단위로 엔티티를 관리합니다.
<br>

**3. 지연로딩 전략이 기본값이 되어야한다.**
>즉시로딩(EAGER) 전략이 아닌 지연로딩(LAZY)인 이유는 뭘까

지금과 같이 엔티티가 얽혀 있는 구조에서 불필요한 JOIN을 방지하고 필요한 순간에만 데이터를 가져오게 하려면 LAZY 전략은 필수입니다.
만약에 모든 것을 EAGER 전략으로 가져오게 된다면
- 조회 성능이 급격히 저하 될 수 있다.
- 연쇄적으로 JOIN이 일어나 row 수가 늘어날 수 있다.
- JPA가 내부적으로 여러번의 중복 JOIN을 생성할 수 있다.

따라서 기본적으로 예외적인 상황을 제외하면 LAZY 전략을 사용하라는 것이 기본 원칙입니다. (아마도...)

### 즉시로딩 VS 지연로딩
| 구분      | 즉시로딩 (EAGER)               | 지연로딩 (LAZY) |
|---------|----------------------------|-------------|
| 정의      | 엔티티 조회 시 연관 데이터까지 즉시 함께 조회 | 엔티티만 먼저 조회하고 필요할 때 추가 조회       | 
| JOIN 발생 | 자동으로 발생                    | 명시적으로 요청할 때만 발생         | 
| row 수   | 다수의 1:N 관계에서 급격하게 증가       | 예측 가능         | 
| 조회 성능   | 구조에 따라 급격히 저하될 수 있음                    | 안정적         | 
| 제어      | JPA에 의해 자동 결정                    | 개발자가 제어        | 
| 장점      | 단순한 구조에서는 편리                    | 불필요한 데이터 조회 방지       | 
| 단점      | 불필요한 JOIN 발생 가능                    | N+1 문제 발생 가능        | 
| 적합한 상황      | 연관 데이터가 항상 필요한 경우                    | 1:N 구조         | 

***
<br>

# 이렇게 해결 해 나갔습니다.

<br>

### fetchJoin 사용  

N+1 문제의 원인은 연관 엔티티를 지연로딩으로 하나씩 추가적으로 조회하는것 때문이라면 가장 먼저 떠올릴 수 있는 해결책은 fetch join을 사용하는 것입니다.
#### fetch join 이란?
fetch join은 연관된 엔티티를 join하면서 동시에 한번에 함께 로딩해 오는 기능입니다.  
쉽게 말하면
> 부모 데이터를 가져올 때 자식들도 한 번에 같이 가져와 줘

<br>

예를 들어 기존에 N+1 문제가 있던 코드가 아래와 같다고 가정하면
```java
// N+1 문제가 발생하는 코드
val votes = voteRepository.findByPostId(postId)    // 1번 쿼리

votes.forEach { vote ->
    println(vote.voteOptions.content)              // Vote마다 추가 쿼리
}
```
- tb_vote 한번 조회
- 각 Vote 마다 voteOptions 를 LAZY로 가져오면서 tb_vote_option 쿼리 N번 실행

<br>

이를 해결하기 위해 QueryDSL을 사용하여 아래와 같이 fetch join을 적용할 수 있습니다.
```java
val v = QVote.vote
val vo = QVoteOption.voteOption

val votes = queryFactory
    .selectFrom(v)
    .leftJoin(v.voteOptions, vo).fetchJoin()
    .where(v.postId.eq(postId))
    .fetch()
```

fetch join 은 JPA에게 이렇게 말합니다.
> **지금 join한 voteOptions를 지연로딩말고 즉시로딩해서 한번에 다 가져와**

즉 로딩 전략을 바꿔버리는 역할을 하기 때문에 이걸 사용하면 JPA는
- Vote를 조회할 때 voteOptions 까지 프록시 없이 채워 넣는다
- 따라서 이후 vote.voteOptions 를 접근 시 추가 쿼리가 절대 발생하지 않는다

<br>

## 하지만 fech join에도 한계가 있다.

이렇게만 보면 fetch join이 만능인것처럼 느껴질 수도 있지만 실제로 적용해보면 다음과 같은 한계를 만날 수 있습니다.
<br>

**1. 여러 컬렉션을 동시에 fetch join 할 수 없다**  
<br>
예를 들어 Vote 엔티티에
- voteOptions(옵션)
- responses(응답)
- log(로그)
이와 같이 컬렉션이 여러 개 있다면
```java
select v from Vote v
join fetch v.voteOptions
join fetch v.responses
join fetch v.logs
```
이런식으로 여러 컬렉션을 한 번에 fetch join 하는 것은 제한이 있습니다.   
따라서 한번에 하나의 컬렉션만 fetch join을 해온다거나 나머지는 따로 조회하고 매핑을 해야하는 불편함을 감수해야합니다.

**2. 페이징에 한계가 있다**  
<br>
fetch join을 적용한 상태에서 Pageable 같은 페이징을 적용하면
- DB입장에서는 row기준으로 페이징
- JPA입장에서는 객체(Vote)기준으로 엔티티 만들어서 페이징

<br>
따라서 Hibernate가 경고 또는 예외를 던지거나 메모리에서 강제로 중복 제거하면서 페이징을 할 수 있기 때문에 페이징은 가급적 피하는게 좋습니다.

예를들어

| post | option 개수 |
|------|-----------|
| 1    | 5개      |
| 2    | 50개      |


- Post 10개를 기준으로 페이지 1을 만들어달라고 요청
<br>

이때 fetch join + 페이징 이슈가 발생하여 만약 DB가 LIMIT 10을 적용하면 row를 기준으로 아래와 같이 10줄만 잘라서 반환합니다. 
<br>

```
P1-O1
P1-O2
P1-O3
P1-O4
P1-O5   → (Post 1의 모든 옵션)
P2-O1
P2-O2
P2-O3
P2-O4
P2-O5
.
.
.
```

<br>

- 하지만 JPA가 이걸 엔티티(Post)로 묶으면?

<br>

- Post 1 -> row 5개
- Post 2 -> row 5개
<br>

결과적으로는 Post는 단 2개만 생성됩니다.   
즉 개발자가 기대한 페이징결과는 Post가 10개가 반환되는건데 실제 fech join을 해서 페이징으로 가져오면 Post는 2개만 가져오게 됩니다.
<br> 

우리는 게시글 수를 기준으로 페이징을 하고 싶은데 DB는 row수를 기준으로 페이징을 해버려서 서로 일치하지 않는 현상이 나타나게 됩니다.  
따라서 fetch join을 쓰면 게시글 1개가 여러줄로 반환되기 때문에 DB가 row 기준으로 페이징을 하게되면 JPA가 게시글 기준으로 엔티티를 만들 수 없어서 정확한 페이징이 불가능해지는 현상이 나타나게 됩니다.


<br>

## DTO Projection 기반 조회로 N+1 문제 해결
> 쿼리 결과를 DTO로 바로 매핑

만약 비지니스 요구사항이 아래와 같다고 가정해보자.

#### 비즈니스 요구사항
- 게시물 10개를 화면에 보여줘야한다.
- 각 게시물에는 이미지가 첨부되어있을 수도 있고 없을 수도 있다.

<br>

#### 해결 방법: DTO Projection + 일괄 조회
**1. 게시물 리스트 조회**
```java
val posts: List<PostDTO> =
    queryFactory
        .select(
            Projections.constructor(
                PostDTO::class.java,
                post.id,
                post.title
            )
        )
        .from(post)
        .where(post.deleteYn.eq("N"))
        .fetch()

val postIds = posts.map { it.id }
```

- 게시물을 조회할 때 엔티티전체가 아니라 랜더링에 필요한 필드만 DTO로 조회
- 즉 게시물의 기본 정보와 ID목록만 추출
<br>

**2. 이미지(게시물 연관데이터)는 추출한 ID목록으로 한번에 조회**
```java
// 게시물에 연결된 이미지 일괄 조회
val images: List<ImageDTO> =
    queryFactory
        .select(
            Projections.constructor(
                ImageDTO::class.java,
                image.postId,
                image.url
            )
        )
        .from(image)
        .where(image.postId.`in`(postIds))
        .fetch()

val imageMap = images.associateBy { it.postId }
```
- 쿼리 1번으로 이미지데이터 조회

<br>

**3. 이미지데이터를 게시물아이디에 맞게 매핑**
```java
posts.forEach { post ->
    post.image = imageMap[post.id]
}
```
이렇게 함으로써 게시물 리스트는 DTO Projection을 통해 한번에 조회하고 이미지는 추출한 ID를 기준으로 일괄 조회한 후 매핑하는 방식을 사용하여 
N+1문제를 해결하였습니다.

<br>

## 하지만 DTO Projection 방식에도 한계는 있다.
**1.영속성 컨테스트를 사용할 수 없다** 

DTO Projection으로 조회한 객체는 엔티티가 아니므로 이 객체는 영속성 컨테스트에 올라가지 않는다는 한계가 있습니다.

**2.LAZY / EAGER과 같은 ORM 기능을 사용할 수 없다** 

 - @ManyToOne(fetch = Lazy)
 - @OneToMany(fetch = Eager)  
<br>
위와 같은 설정이 아무런 의미가 없어질 수 있습니다. 따라서 ORM의 편의적인 기능을 사용하지 못해 사용자의 제어가 필요하다는 단점이 있습니다.

**3.코드량이 늘어나거나 재사용성이 떨어질 수 있다**

아무래도 여러번의 조회 쿼리를 작성해야하고 수동으로 매핑을 해줘야하는 코드가 필요하기 때문에   
fetch join으로 한번에 끝내는 방식과 비교해서 코드가 길어지기도 하고 다른 개발자가 처음 이 코드를 봤을때도 복잡해보일 수 있다는 단점이 있습니다.

***
<br>

# 마무리하며
N+1 문제에는 해결법이 정해져 있는것은 아니고 프로젝트의 구조와 목적에 따라 적절한 해결 방법을 선택하는 것이 중요하다고 생각합니다.  

저같은 경우에는 게시물 조회 시 연관 데이터가 많고 조회와 관련된 API이기 때문에 fetch join을 사용하는 방식보다는
DTO Projection 기반으로 필요한 데이터를 명시적으로 조회하는 방식이 더 적합하다고 판단했습니다.

그 결과 기존에 약 6초 이상 소요되던 게시물 조회 쿼리가 DTO Projection 방식으로 개선한 이후 약 0.8초 수준까지 단축되는 효과를 확인할 수 있었다.

결론적으로 N+1 문제를 해결할 때는 무조건 fetch join을 사용한다거나 무조건 DTO Projection이 정답이다라고 접근하기보다는,

조회인지 수정인지, 페이징이 필요한지, 데이터의 구조가 어떤지 등을 종합적으로 고려해 각자의 상황에 맞는 최적의 방식을 선택하는 것이 중요하다고 생각합니다.

이번 경험을 통해 ORM을 무조건 편의 기능으로만 사용하기보다는 필요에 따라 적절히 제어하며 사용하는 것이 실무에서 더 안정적인 시스템을 만드는 데 도움이 된다는 점을 다시 한 번 느낄 수 있었다.