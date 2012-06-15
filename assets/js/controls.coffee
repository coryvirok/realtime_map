# document.ontouchmove = (event) -> event.preventDefault()

$ ->
  setTimeout (-> window.scrollTo(0, 1)), 0
  $('body').css('height', $(window).height() - 100)

  $('#toggle').on 'click', ->
    now.togglePause()
