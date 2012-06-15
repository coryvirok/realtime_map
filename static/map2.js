// Realtime map...test.

var map = new L.Map('map');
var cloudmade = new L.TileLayer('http://{s}.tile.cloudmade.com/151c95d495334f98ad1e346cbb7e87d6/65306/256/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
    maxZoom: 18
});
var center_of_world = new L.LatLng(0,0); // geographical point (longitude and latitude)
map.setView(center_of_world, 2).addLayer(cloudmade);
var markerLocation = new L.LatLng(37.7895768, -122.403743);

var marker = new L.Marker(markerLocation);
map.addLayer(marker);
