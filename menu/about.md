<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />

<style>
  .hero-swiper {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    position: relative; /* 중요 */
  }
  .hero-swiper .swiper-slide img {
    width: 100%;
    height: auto;
    display: block;
  }

  /* 버튼이 클릭되게 위로 올리기 */
  .hero-swiper .hero-prev,
  .hero-swiper .hero-next {
    z-index: 10;
  }
</style>

<div class="swiper hero-swiper">
  <div class="swiper-wrapper">
    <div class="swiper-slide">
      <img src="./img/jwt/token5.png" alt="slide1" />
    </div>
    <div class="swiper-slide">
      <img src="./img/jwt/token3.png" alt="slide2" />
    </div>
  </div>

  <!-- 고유 클래스 -->
  <div class="swiper-button-prev hero-prev"></div>
  <div class="swiper-button-next hero-next"></div>
  <div class="swiper-pagination hero-pagination"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<script>
  const el = document.querySelector(".hero-swiper");

  new Swiper(el, {
    loop: true,
    autoplay: { delay: 3500, disableOnInteraction: false },
    pagination: { el: el.querySelector(".hero-pagination"), clickable: true },
    navigation: {
      nextEl: el.querySelector(".hero-next"),
      prevEl: el.querySelector(".hero-prev"),
    },
  });
</script>
