#= require gameplay_view

# TODO
# attach icons to points

# for dragging
m0 = null
o0 = null

running = false
refresh_count = 0
window.eventLog = {}
window.missingFeatures = {}

POINT_TIMEOUT_MS = 500
DECAY_STEP = 10
DECAY_FACTOR = 0.98
BASE_FILL_COLOR = d3.rgb("#fff")
HITS_NORMALIZER = 80

$ ->
  $window = $(window)
  WIDTH = $window.width()
  HEIGHT = $window.height()
  RADIUS = Math.min(WIDTH/3, HEIGHT/2) - 50
  GLOBE_X = WIDTH/3
  GLOBE_Y = HEIGHT/2
  features = {}
  events = null

  gameplayView = new GameplayView '#sidebar'

  if location.search.match /joyent/
    window.now = nowInitialize 'http://8.19.35.8:5000'

  projection = d3.geo.azimuthal()
    .scale(RADIUS)
    .origin([-102, 20])
    .mode("orthographic")
    .translate([GLOBE_X, GLOBE_Y])

  circle = d3.geo.circle().origin(projection.origin())
  path = d3.geo.path().projection(projection)

  mousedown = ->  
    m0 = [d3.event.pageX, d3.event.pageY]
    o0 = projection.origin()
    d3.event.preventDefault()

  svg = d3.select("#map").append("svg:svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .on("mousedown", mousedown)

  svg.append('circle')
    .attr('id', 'globe-background')
    .attr('r', RADIUS)
    .attr('cx', GLOBE_X)
    .attr('cy', GLOBE_Y)

  loadCountries = (onComplete) ->
    d3.json "world-countries.json", (collection) ->
      features.countries = svg.append('svg:g')
        .attr('id', 'countries')
        .selectAll("path")
        .data(collection.features)
        .enter().append("svg:path")
        .attr("d", clip)
        .attr("data-country", (d) -> d.properties.name)

      features.countries.append("svg:title").text (d) -> d.properties.name
      onComplete?()
      
  loadStates = (onComplete) ->
    d3.json 'us-states.json', (collection) ->
      features.states = svg.append('svg:g')
        .attr('id', 'states')
        .selectAll("path")
        .data(collection.features)
        .enter().append("svg:path")
        .attr("d", clip)
        .attr('data-state', (d) -> d.properties.abbrev)

      features.lumos = svg.append('svg:path')
        .data([{
          "type": "Feature",
          "properties": {"name": "Lumos Labs"},
          "geometry": {
            "type": "Point",
            "coordinates": [-122.403743, 37.789577]
          }
        }])
        .attr('id', 'lumoslabs')
        .attr('d', clip)

      onComplete?()

  mousemove = ->
    if m0?
      m1 = [d3.event.pageX, d3.event.pageY]
      o1 = [o0[0] + (m0[0] - m1[0]) / 8, o0[1] + (m1[1] - m0[1]) / 8]
      projection.origin(o1)
      circle.origin(o1)
      refresh()

  mouseup = ->
    if m0?
      mousemove()
      m0 = null

  d3.select(window).on("mousemove", mousemove).on("mouseup", mouseup)

  updateFill = (d) ->
    d.properties.hits or= 0
    d.properties.hits *= DECAY_FACTOR
    darken_factor = d.properties.hits / HITS_NORMALIZER
    console.log("#{d.properties.name} #{darken_factor}") if darken_factor > 12
    new_color = BASE_FILL_COLOR.darker(darken_factor).toString()
    new_color

  refresh = ->
    refresh_count += 1
    now = new Date().getTime()

    events.selectAll('path').filter((d, i) -> d.properties.expire < now).remove()
    features.events = events.selectAll('path')

    if refresh_count % DECAY_STEP == 0
      features.countries.style 'fill', updateFill
      features.states.style 'fill', updateFill

    paths.attr 'd', clip for name, paths of features

  clip = (d) -> path circle.clip(d)

  incrementHits = (selector) ->
    feature = d3.select(selector)
    if feature_data = feature.data()[0]
      properties = feature_data.properties
      properties.hits or= 0
      properties.hits += 1
    else
      missingFeatures[selector] or= 0
      missingFeatures[selector] += 1

  handleNewEvent = (data) ->
    return unless running

    eventName = data.data.message.body.event.name
    if !eventLog[eventName]
      eventLog[eventName] = {sample: data, count: 1}
    else
      eventLog[eventName].count += 1

    geoData = data.geoData
    latitude = geoData.latitude
    longitude = geoData.longitude
    countryName = geoData.country_name

    if countryName == "United States"
      incrementHits "[data-state='#{geoData.region}']"
    else
      incrementHits "[data-country='#{countryName}']"

    events.append('svg:path')
      .data([{
        type: "Feature",
        properties: {
          expire: new Date().getTime() + POINT_TIMEOUT_MS
        },
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude]
        }
      }])
      .attr('d', clip).attr('class', "event #{eventName}")

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

      now.pause = (pause) ->
        if pause
          clearInterval turning
          running = false
        else if !running
          turning = setInterval (-> turn(0.2)), 10
          running = true

      # Handle new messages from the server
      now.message = handleNewEvent
      now.ready -> now.start()
  
  now.receiveIndex = (index) ->
    console.log index
