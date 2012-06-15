class GameplayView

  gamesPerSection: 5

  constructor: (selector) ->

    @view = $(selector)

    @svg = d3.select(selector).append('svg')
      .attr('width', @view.width())
      .attr('height', @view.height() - 100)
      .style('margin-top', 50)

    for name, i in ['Memory', 'Attention', 'Speed', 'Flexibility', 'Problem Solving']
      @buildArea(name, i) 

  buildArea: (name, offset) ->

    index = d3.range(@gamesPerSection)
    data = index.map d3.random.normal(100, 10)

    height = @svg.attr('height')

    x = d3.scale.linear()
      .domain([0, d3.max(data)])
      .range([0, @view.width()])

    start_y = height * offset / 5 + 20
    y = d3.scale.ordinal()
      .domain(index)
      .rangeRoundBands([start_y, start_y + height / 5 - 30], .1)

    area = @svg.append('g').attr('data-area', name)

    area.append('text')
      .attr("text-anchor", "end")
      .attr('x', @view.width() - 20)
      .attr('y', start_y)
      .text(name)

    bar = area.selectAll(".bar")
      .data(data)
      .enter().append("g")
      .attr("class", "bar")
      .attr("transform", (d, i) -> "translate(0,#{y(i)})")

    bar.append("rect")
      .attr("height", y.rangeBand() - 3)
      .attr("width", (d) -> x(d) - 10)
      .attr("x", (d) => @view.width() - x(d) + 10)

    bar.append("text")
      .attr("text-anchor", "end")
      .attr("x", @view.width() - 20)
      .attr("y", y.rangeBand() / 2)
      .attr("dy", ".25em")
      .text((d, i) -> i)

    sort = false

    setInterval =>

      if (sort = !sort)
        index.sort((a, b) -> data[a] - data[b])
      else
        index = d3.range(@gamesPerSection)

      y.domain(index)

      bar.transition()
        .duration(500)
        .delay((d, i) -> i * 50)
        .attr("transform", (d, i) -> "translate(0,#{y(i)})")

    , 3000

window.GameplayView = GameplayView
