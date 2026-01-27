// GitHub API를 사용하여 폴더 내의 파일 목록 가져오기 (스키마 및 url 참고)
// https://api.github.com/repos/paullabkorea/github_blog/contents/menu
// https://api.github.com/repos/paullabkorea/github_blog/contents/blog
let blogList = [];
let blogMenu = [];
let isInitData = false;

async function initDataBlogList() {
    /*
    blogList를 초기화 하기 위한 함수
    if 로컬이라면 blogList = /data/local_blogList.json 데이터 할당
    else if 배포상태이면 blogList = GitHub에 API 데이터 할당
    */
    if (blogList.length > 0) {
        // blogList 데이터가 이미 있을 경우 다시 로딩하지 않기 위함(API 호출 최소화)
        return blogList;
    }

    // 데이터 초기화를 한 번 했다는 것을 알리기 위한 변수
    isInitData = true;

    try {
        if (isLocal) {
            // 로컬 환경
            const response = await fetch(
                url.origin + "/data/local_blogList.json"
            );
            blogList = await response.json();
        } else {
            // GitHub 배포 상태
            // 만약 siteConfig.username이 비어있거나 siteConfig.repositoryName이 비어 있다면 해당 값을 지정하여 시작
            // config에서 값이 없을 경우 URL에서 추출
            if (!siteConfig.username || !siteConfig.repositoryName) {
                const urlConfig = extractFromUrl();
                siteConfig.username = siteConfig.username || urlConfig.username;
                siteConfig.repositoryName =
                    siteConfig.repositoryName || urlConfig.repositoryName;
            }

            let response;

            // 배포 상태에서 GitHub API를 사용(이용자가 적을 때)
            if (!localDataUsing) {
                response = await fetch(
                    `https://api.github.com/repos/${siteConfig.username}/${siteConfig.repositoryName}/contents/blog`
                );
                
                // API 응답 체크
                if (!response.ok) {
                    if (response.status === 403) {
                        console.warn('GitHub API rate limit exceeded. Please enable localDataUsing in config.js');
                    }
                    throw new Error(`GitHub API error: ${response.status}`);
                }
            } else {
                // 배포 상태에서 Local data를 사용(이용자가 많을 때)
                response = await fetch(
                    url.origin + `/${siteConfig.repositoryName}/data/local_blogList.json`
                );
            }
            
            blogList = await response.json();
            
            // 배열인지 확인
            if (!Array.isArray(blogList)) {
                console.error('blogList is not an array:', blogList);
                blogList = [];
                return blogList;
            }
        }

        // console.log(blogList);

        // 정규표현식에 맞지 않는 파일은 제외하여 blogList에 재할당
        blogList = blogList.filter((post) => {
            const postInfo = extractFileInfo(post.name);
            if (postInfo) {
                return post;
            }
        });

        blogList.sort(function (a, b) {
            return b.name.localeCompare(a.name);
        });
    } catch (error) {
        console.error('Failed to load blog list:', error);
        blogList = [];
    }
    
    return blogList;
}

async function initDataBlogMenu() {
    if (blogMenu.length > 0) {
        // blogMenu 데이터가 이미 있을 경우(API 호출 최소화)
        return blogMenu;
    }

    try {
        if (isLocal) {
            // 로컬환경
            const response = await fetch(
                url.origin + "/data/local_blogMenu.json"
            );
            blogMenu = await response.json();
        } else {
            // GitHub 배포 상태
            // 만약 siteConfig.username이 비어있거나 siteConfig.repositoryName이 비어 있다면 해당 값을 지정하여 시작
            // config에서 값이 없을 경우 URL에서 추출
            if (!siteConfig.username || !siteConfig.repositoryName) {
                const urlConfig = extractFromUrl();
                siteConfig.username = siteConfig.username || urlConfig.username;
                siteConfig.repositoryName =
                    siteConfig.repositoryName || urlConfig.repositoryName;
            }

            let response;

            // 배포 상태에서 GitHub API를 사용(이용자가 적을 때)
            if (!localDataUsing) {
                response = await fetch(
                    `https://api.github.com/repos/${siteConfig.username}/${siteConfig.repositoryName}/contents/menu`
                );
                
                // API 응답 체크
                if (!response.ok) {
                    if (response.status === 403) {
                        console.warn('GitHub API rate limit exceeded. Please enable localDataUsing in config.js');
                    }
                    throw new Error(`GitHub API error: ${response.status}`);
                }
            } else {
                // 배포 상태에서 Local data를 사용(이용자가 많을 때)
                response = await fetch(
                    url.origin + `/${siteConfig.repositoryName}/data/local_blogMenu.json`
                );
            }
            
            blogMenu = await response.json();
            
            // 배열인지 확인
            if (!Array.isArray(blogMenu)) {
                console.error('blogMenu is not an array:', blogMenu);
                blogMenu = [];
                return blogMenu;
            }
        }
    } catch (error) {
        console.error('Failed to load blog menu:', error);
        blogMenu = [];
    }
    
    return blogMenu;
}
