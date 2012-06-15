class GameplayView

  gamesPerSection: 3

  gameBrainAreas:
    "Speed Match": "Speed"
    "Spatial Speed Match": "Speed"
    "Speed Brain: iPhone": "Speed"
    "Speed Brain: Pre": "Speed"
    "Circles: iPhone": "Speed"
    "Shapes: iPhone": "Speed"
    "Spatial: iPhone": "Speed"
    "Speed Brain: Blackberry": "Speed"
    "Speed Brain: Android": "Speed"
    "Penguin Pursuit": "Speed"
    "Rotation Matrix": "Speed"
    "Moneycomb": "Memory"
    "Memory Matrix": "Memory"
    "moneycomb evaluation": "Memory"
    "Memory Matrix: iPhone": "Memory"
    "Memory Match": "Memory"
    "Monster Garden": "Memory"
    "Memory Match Overload": "Memory"
    "Rhyme Workout": "Memory"
    "Memory Circles: iPhone": "Memory"
    "Memory Shapes: iPhone": "Memory"
    "Memory Lane": "Memory"
    "Name Tag": "Memory"
    "Familiar Faces": "Memory"
    "Face Memory Workout": "Memory"
    "Birdwatching": "Attention"
    "Top Chimp": "Attention"
    "Space Junk": "Attention"
    "Eagle Eye": "Attention"
    "Observation Tower": "Attention"
    "Lost in Migration": "Attention"
    "Playing Koi": "Attention"
    "Lost in Migration: iPhone": "Attention"
    "Brain Shift": "Flexibility"
    "Brain Shift Overdrive": "Flexibility"
    "Disillusion": "Flexibility"
    "Disconnection": "Flexibility"
    "Brain Shift: iPhone": "Flexibility"
    "Word Bubbles": "Flexibility"
    "Word Bubbles Rising": "Flexibility"
    "Color Match": "Flexibility"
    "Color Match: iPhone": "Flexibility"
    "Color Match: Pre": "Flexibility"
    "Route to Sprout": "Flexibility"
    "Raindrops": "Problem Solving"
    "Addition Storm": "Problem Solving"
    "Subtraction Storm": "Problem Solving"
    "Division Storm": "Problem Solving"
    "Multiplication Storm": "Problem Solving"
    "Raindrops: iPhone": "Problem Solving"
    "Chalkboard Challenge": "Problem Solving"
    "Chalkboard Challenge: iPhone": "Problem Solving"
    "By the Rules": "Problem Solving"
    "Word Sort": "Problem Solving"

  constructor: (selector) ->

    @view = $(selector)

    @svg = d3.select(selector).append('svg')
      .attr('width', @view.width() - 100)
      .attr('height', @view.height() - 100)
      .style('margin-top', 50)
      .style('margin-left', 50)

    @events = {}
    @max = 1
    for game, area of @gameBrainAreas
      @events[area] or= {}
      @events[area][game] = {game: game, count: 0, times: []}

    @buildAreas()

  barWidth: (d) => Math.max(@x(d.count) - 30, 1)

  buildAreas: (area_name, offset) ->
    height = @svg.attr('height')
    width = @svg.attr('width')

    @x = d3.scale.linear()
      .domain([0, @max])
      .range([0, width])

    area_setups = []
    for area_name, offset in ['Memory', 'Attention', 'Speed', 'Flexibility', 'Problem Solving']

      areaGames = @events[area_name]
      data = (v for k, v of areaGames)

      start_y = height * offset / 5 + 20
      y = d3.scale.ordinal()
        .domain([0..@gamesPerSection-1])
        .rangeRoundBands([start_y, start_y + height / 5 - 30], .1)

      area = @svg.append('g').attr('data-area', area_name)

      area.append('text')
        .attr('x', 0)
        .attr('y', start_y - 5)
        .text(area_name)
        .attr('class', 'area-title')

      bar = area.selectAll(".bar")
        .data(data)
        .enter().append("g")
        .attr("class", "bar")
        .sort((d1, d2) -> d2.count - d1.count)
        .attr("transform", (d, i) -> "translate(0,#{y(i)})")
        .attr('visibility', (d, i) => if i < @gamesPerSection then 'visible' else 'hidden')

      bar.append("rect")
        .attr("height", y.rangeBand() - 3)
        .attr("width", @barWidth)

      bar.append("text")
        .attr("x", 10)
        .attr("y", y.rangeBand() / 2)
        .attr("dy", ".25em")
        .text((d) -> d.game)

      bar.append('text')
        .attr('class', 'count')
        .attr('x', width)
        .attr('text-anchor', 'end')
        .attr("y", y.rangeBand() / 2)
        .attr("dy", ".25em")
        .text((d) -> d.count)

      area_setups.push [bar, y]

    setInterval (=> @refresh(area_setups)), 1000

  refresh: (area_setups) ->
    newmax = 0
    now = new Date().getTime()
    for area, game of @events
      for game_name, info of game
        do (info, newmax, now) ->
          before = info.times.length
          newtimes = (time for time in info.times when now - time < 3600000)
          if newtimes.length < before
            info.times = newtimes
            info.count = info.times.length
            console.log("trimmed #{info.game} times from #{before} to #{info.count}")
          newmax = Math.max(newmax, info.count)

    @max = Math.max(@max, newmax)
    @x.domain [0, @max]

    for setup in area_setups
      do (setup, @x, @gamesPerSection, @barWidth) ->
        bar = setup[0]
        y = setup[1]
        bar.sort((d1, d2) -> d2.count - d1.count)
          .attr('visibility', (d, i) => 
            if i < @gamesPerSection then 'visible' else 'hidden')
          .transition()
          .duration(500)
          .delay((d, i) -> i * 50)
          .attr("transform", (d, i) -> "translate(0,#{setup[1](i)})")

        bar.selectAll('[visibility="visible"] rect').attr("width", @barWidth)
        bar.selectAll('[visibility="visible"] .count').text((d) -> d.count)

  addEvent: (event) ->
    game = event.prop_map.game
    area = @gameBrainAreas[game]
    unless area
      # FIXME some iphone version sends 'names-like-this'
      # console.log(game)
      return
    @events[area][game].times.push new Date().getTime()
    @events[area][game].count += 1
    @max = Math.max @events[area][game].count, @max

window.GameplayView = GameplayView
