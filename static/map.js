
now.message = function(data) {
  // console.log(data);
}

$(function() {

  var WIDTH = $(window).width(), HEIGHT = $(window).height();
  var RADIUS = Math.min(WIDTH, HEIGHT)/2 - 20;

  var feature, point;

  var projection = d3.geo.azimuthal()
      .scale(RADIUS)
      .origin([-71.03,42.37])
      .mode("orthographic")
      .translate([WIDTH/2, HEIGHT/2]);

  var circle = d3.geo.circle().origin(projection.origin());

  var path = d3.geo.path().projection(projection);

  var svg = d3.select("#map").append("svg:svg")
      .attr("width", WIDTH)
      .attr("height", HEIGHT)
      .on("mousedown", mousedown);

  svg.append('circle')
    .attr('id', 'globe-background')
    .attr('r', RADIUS)
    .attr('cx', WIDTH/2)
    .attr('cy', HEIGHT/2);

  d3.json("world-countries.json", function(collection) {
    feature = svg.selectAll("path")
        .data(collection.features)
      .enter().append("svg:path")
        .attr("d", clip);

    feature.append("svg:title").text(function(d) { return d.properties.name; });

    point = svg.append('svg:path').data([{
      "type": "Feature",
      "properties": {"name": "Lumos Labs"},
      "geometry": {
        "type": "Point",
        "coordinates": [-122.403743, 37.789577],
      }
    }]).attr('id', 'lumoslabs').attr('d', clip);
  });

  d3.select(window)
      .on("mousemove", mousemove)
      .on("mouseup", mouseup);

  var m0, o0;

  function mousedown() {
    m0 = [d3.event.pageX, d3.event.pageY];
    o0 = projection.origin();
    d3.event.preventDefault();
  }

  function mousemove() {
    if (m0) {
      var m1 = [d3.event.pageX, d3.event.pageY],
          o1 = [o0[0] + (m0[0] - m1[0]) / 8, o0[1] + (m1[1] - m0[1]) / 8];
      projection.origin(o1);
      circle.origin(o1)
      refresh();
    }
  }

  function mouseup() {
    if (m0) {
      mousemove();
      m0 = null;
    }
  }

  function refresh(duration) {
    (duration ? feature.transition().duration(duration) : feature).attr("d", clip);
    (duration ? point.transition().duration(duration) : point).attr("d", clip);
  }

  function clip(d) {
    return path(circle.clip(d));
  }

});
