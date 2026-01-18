<!-- Swiper CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />

<style>
  .hero-swiper { width: 100%; border-radius: 12px; overflow: hidden; }
  .hero-swiper .swiper-slide img { width: 100%; height: auto; display: block; }
</style>

<div class="swiper hero-swiper">
  <div class="swiper-wrapper">
    <div class="swiper-slide">
      <img src="./img/jwt/token5.png" alt="slide1" />
    </div>
    <div class="swiper-slide">
      <img src="./img/jwt/token4.png" alt="slide2" />
    </div>
  </div>

  <div class="swiper-button-prev"></div>
  <div class="swiper-button-next"></div>
  <div class="swiper-pagination"></div>
</div>

<!-- Swiper JS -->
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
<script>
  new Swiper(".hero-swiper", {
    loop: true,
    autoplay: { delay: 3500, disableOnInteraction: false },
    pagination: { el: ".swiper-pagination", clickable: true },
    navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
  });
</script>