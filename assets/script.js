document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header')
  const shadow = _ => window.scrollY
    ? header.classList.add('is-scrolling')
    : header.classList.remove('is-scrolling')

  window.addEventListener('scroll', shadow)
  window.addEventListener('wheel', shadow)
  window.addEventListener('touchmove', shadow)
})
