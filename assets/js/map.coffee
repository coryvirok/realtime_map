paused = false

$ ->
  $window = $(window)
  WIDTH = $window.width()
  HEIGHT = $window.height()
  RADIUS = Math.min(WIDTH, HEIGHT)/2 - 20
  POINT_TIMEOUT_MS = 1000
  features = {}
  events = null

  if location.search.match /joyent/
    window.now = nowInitialize 'http://8.19.35.8:5000'

  projection = d3.geo.azimuthal()
    .scale(RADIUS)
    .origin([-102, 20])
    .mode("orthographic")
    .translate([WIDTH/2, HEIGHT/2])

  circle = d3.geo.circle().origin(projection.origin())

  path = d3.geo.path().projection(projection).pointRadius(1.5)

  svg = d3.select("#map").append("svg:svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .on("mousedown", mousedown)

  svg.append('circle')
    .attr('id', 'globe-background')
    .attr('r', RADIUS)
    .attr('cx', WIDTH/2)
    .attr('cy', HEIGHT/2)

  loadCountries = (onComplete) ->
    d3.json "world-countries.json", (collection) ->
      countries = svg.append('svg:g')
        .attr('id', 'countries')
        .selectAll("path")
        .data(collection.features)
        .enter().append("svg:path")
        .attr("d", clip)

      countries.append("svg:title").text (d) -> d.properties.name
      features['countries'] = countries

      onComplete?()
      
  loadStates = (onComplete) ->
    d3.json 'us-states.json', (collection) ->
      features['states'] = svg.append('svg:g')
        .attr('id', 'states')
        .selectAll("path")
        .data(collection.features)
        .enter().append("svg:path")
        .attr("d", clip)

      features['lumos'] = svg.append('svg:path')
        .data([{
          "type": "Feature",
          "properties": {"name": "Lumos Labs"},
          "geometry": {
            "type": "Point",
            "coordinates": [-122.403743, 37.789577],
          }
        }])
        .attr('id', 'lumoslabs')
        .attr('d', clip)

      onComplete?()

  d3.select(window)
    .on("mousemove", mousemove)
    .on("mouseup", mouseup)

  m0 = null
  o0 = null

  mousedown = ->
    m0 = [d3.event.pageX, d3.event.pageY]
    o0 = projection.origin()
    d3.event.preventDefault()

  mousemove = ->
    if (m0)
      m1 = [d3.event.pageX, d3.event.pageY]
      o1 = [o0[0] + (m0[0] - m1[0]) / 8, o0[1] + (m1[1] - m0[1]) / 8]
      projection.origin(o1)
      circle.origin(o1)
      refresh()

  mouseup = ->
    if (m0)
      mousemove()
      m0 = null

  refresh = ->
    now = new Date().getTime()

    events.selectAll('path').filter((d, i) -> d.properties.expire < now).remove()
    features['events'] = events.selectAll('path')

    $.each features, (name, paths) ->
      paths.attr('d', clip)

  clip = (d) ->
    path circle.clip(d)

  loadCountries ->
    loadStates ->

      # this must be added after the countries and states in order to show up above them
      events = svg.append('svg:g').attr('id', 'events')
      
      turning = null

      window.turn = (degrees) ->
        newOrigin = projection.origin()
        newOrigin[0] = ((newOrigin[0] + 180 + degrees) % 360) - 180
        projection.origin(newOrigin)
        circle.origin(newOrigin)
        refresh()

      window.pause = ->
        paused = true
        clearInterval turning

      window.play = ->
        turning = setInterval (-> window.turn(0.2)), 10

      play()

      # Handle new messages from the server
      now.message = (data) ->
        return if paused

        eventName = data.data.message.body.event.name
        window.eventLog or= {}
        if !eventLog[eventName]
          eventLog[eventName] = {sample: data, count: 1}
          console.log(eventName)
        else
          eventLog[eventName].count += 1

        geoData = data.geoData
        latitude = geoData.latitude
        longitude = geoData.longitude
        countryName = geoData.country_name

        events.append('svg:path')
          .data([{
            "type": "Feature",
            "properties": {
              "expire": new Date().getTime() + POINT_TIMEOUT_MS
            },
            "geometry": {
              "type": "Point",
              "coordinates": [longitude, latitude]
            }
          }])
          .attr('d', clip).classed(eventName, true)

