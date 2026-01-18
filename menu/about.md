<style>
  .snap-carousel {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 16px;
    padding: 8px 0;
    -webkit-overflow-scrolling: touch;
  }
  .snap-carousel::-webkit-scrollbar { display: none; }

  .snap-carousel .slide {
    flex: 0 0 100%;
    scroll-snap-align: start;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }
  .snap-carousel img {
    width: 100%;
    height: auto;
    display: block;
  }
</style>

<div class="snap-carousel">
  <div class="slide"><img src="./img/jwt/token5.png" alt="slide1"></div>
  <div class="slide"><img src="./img/jwt/token3.png" alt="slide2"></div>
</div>