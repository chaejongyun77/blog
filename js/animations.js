// ============================================
// 헤더 스크롤 효과
// ============================================

let lastScrollTop = 0;
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  // 스크롤 시 헤더에 그림자 추가
  if (scrollTop > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
  
  lastScrollTop = scrollTop;
});

// ============================================
// 카드 나타나기 애니메이션 (Intersection Observer)
// ============================================

const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      // 순차적으로 나타나도록 delay 추가
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, index * 100);
      
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// 페이지 로드 시 카드들에 observer 적용
function initCardAnimations() {
  const cards = document.querySelectorAll('.blog-card');
  cards.forEach((card, index) => {
    // 초기 상태 설정
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    
    observer.observe(card);
  });
}

// DOM이 로드된 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCardAnimations);
} else {
  initCardAnimations();
}

// ============================================
// 검색창 포커스 효과
// ============================================

const searchInput = document.getElementById('search-input');
if (searchInput) {
  const searchWrapper = searchInput.closest('.search-cont');
  
  searchInput.addEventListener('focus', () => {
    searchWrapper?.classList.add('search-input-wrapper');
  });
  
  searchInput.addEventListener('blur', () => {
    searchWrapper?.classList.remove('search-input-wrapper');
  });
}

// ============================================
// 페이지 전환 시 애니메이션 재적용
// ============================================

// render.js에서 호출할 수 있도록 전역 함수로 export
window.reinitAnimations = function() {
  initCardAnimations();
};
