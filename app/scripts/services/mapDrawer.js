'use strict';

angular.module('trackerApp').factory('mapDrawer', [
    '$window',
    '$http',
    '$q',
    '_',
    'd3', function ($window, $http, $q, _, d3) {

    //canvas and geoPath used for all
    var dim, vis, projection, path;

    //zoom and pan for the map
    function zoomed() {
        vis.attr('transform', d3.event.transform);
    }

    /****
    // Base Map -- streets, neighborhood name, and all muni routes path
    ****/

    //draw street path
    function drawStreets(data) {
        vis.selectAll('.js-st').data(data.features).enter().append('path')
            .attr('d', path)
            .style('fill', 'none')
            .attr('class', 'js-st stroke-lightGrey');
    }

    //draw neighborhood name text
    function drawNeighborhoods(data) {
        vis.selectAll('.js-nh')
            .data(data.features)
            .enter()
            .append('text')
            .text(function(d){
                return d.properties.neighborho;
            })
            .attr('x', function(d){
                return path.centroid(d)[0];
            })
            .attr('y', function(d){
                return  path.centroid(d)[1];
            })
            .attr('class', 'js-nh pos-middel v-central size-tiny');
    }

    function drawRoutes(data) {
        _.each(data, function (route) {

            //draw pathes of all routes as transparent stroke
            vis.selectAll('.js-routes-path-' + route.tag)
                .data(route.featureList)
                .enter()
                .append('path')
                .attr('d', path)
                .style('fill', 'none')
                .style('opacity', 0)
                .attr('class', 'js-routes-' + route.tag + //for route show/hide
                    ' js-routes-path-' + route.tag); //for d3 data binding

            //draw stops by direction
            _.each(route.directions, function (dir) {
                vis.selectAll('.js-routes-stop-' + route.tag + '-' + dir.tag)
                    .data(dir.stops)
                    .enter()
                    .append('circle')
                    .attr('cx', function (d) {
                        return projection(d.coordinates)[0];
                    })
                    .attr('cy', function (d) {
                        return projection(d.coordinates)[1];
                    })
                    .attr('r', 1)
                    .style('fill', '#fff')
                    .style('opacity', 0)
                    .attr('class', 'js-routes-' + route.tag + //for route show/hide
                        //' js-loc-' + route.tag + '-' + dir.tag + //for direction toggle
                        ' js-routes-stop-' + route.tag + '-' + dir.tag); //for d3 data binding
            });
        });
    }

    this.loadBaseMap = function(loadingDoneCallback) {

        //width and height of the base map
        dim = {
            w: d3.select('.js-map').node().getBoundingClientRect().width,
            h: $window.innerHeight
        };

        var svg = d3.select('.js-map')
            .append('svg')
            .attr('width', dim.w)
            .attr('height', dim.h);
        vis = svg.append('g');

        //load three SF map datasets
        var files = _.map(['streets', 'neighborhoods', 'routes'], function (fileName) {
            return $http.get('data/' + fileName + '.json');
        });
        $q.all(files).then(function (res) {

            //geo path settings
            projection = d3.geoMercator().scale(1).translate([0,0]).precision(0);
            path = d3.geoPath().projection(projection);
            var bounds = path.bounds(res[0].data);
            var scale = 0.95 / Math.max((bounds[1][0] - bounds[0][0]) / dim.w,
                (bounds[1][1] - bounds[0][1]) / dim.h);
            var translation = [(dim.w - scale * (bounds[1][0] + bounds[0][0])) / 2,
                (dim.h - scale * (bounds[1][1] + bounds[0][1])) / 2];
            projection.scale(scale).translate(translation);

            //put layers of three datasets
            drawStreets(res[0].data);
            drawNeighborhoods(res[1].data);
            drawRoutes(res[2].data);

            //put zoom & pan rec
            svg.append('rect')
                .attr('width', dim.w)
                .attr('height', dim.h)
                .style('fill', 'none')
                .style('pointer-events', 'all')
                .call(d3.zoom()
                    .scaleExtent([1, 8])
                    .on('zoom', zoomed));

            //get objects of routes info used for HTML/main.js
            loadingDoneCallback(res[2].data);
        });
    };
    /* end of base map */

    //location, angle of each vehicle by route tag
    //updated after new data arrives
    var selectedRoutes = {};

    function getVehicleShape(x, y) {

        //triangle dimension
        var height = 8;
        var width = 6;

        //starting point - center of the triangle
        var sp = 'M ' + x + ' ' + (y - height / 2);

        return sp +
            ' l ' + (width / 2) + ' ' + height + //right edge
            ' h ' + -width + ' z '; //left edge
    }

    function getVehicleRotation(angle, x, y) {
        return 'rotate(' + angle + ' ' + x + ' ' + y + ')';
    }

    function drawVehicleShape(routeTag, dirTag, vId, x, y, angle, color) {
        //vehicle triangle - rotate according to the angle
        vis.append('path')
            .attr('d', getVehicleShape(x, y))
            .attr('transform', getVehicleRotation(angle, x, y))
            .style('fill', color)
            .style('stroke', 'black')
            .attr('class', 'js-loc-' + routeTag + //used for add/remove of the route
                ' js-loc-' + routeTag + '-' + vId + //for transition
                ' js-loc-' + routeTag + '-' + dirTag); //for direction toggle
    }

    function updateVehiclesLocation(data, route) {

        //when new data is successfully gotten
        //4 cases of data

        var oldIds = _.keys(selectedRoutes[route.tag]);

        _.each(data, function (v, id) {

            //stop points
            var x = projection(v.coor)[0];
            var y = projection(v.coor)[1];
            var angle = v.angle;

            //vehicles with the ID is drawn previously
            if (_.contains(oldIds, id)) {

                //previous info of the ID - used for correct transition
                var prev = selectedRoutes[route.tag][id];

                //set transition only if the position changes
                var prevX = projection(prev.coor)[0];
                var prevY = projection(prev.coor)[1];

                if (prevX !== x || prevY !== y) {

                    //case 1 - animate vehicle
                    d3.select('.js-loc-' + route.tag + '-' + id)
                        .style('stroke', '#c31152') //muni color
                        .transition()
                        .attrTween('d', function () {
                            return d3.interpolateString(
                                getVehicleShape(prevX, prevY),
                                getVehicleShape(x, y)
                            );
                        })
                        .attrTween('transform', function () {
                            return d3.interpolateString(
                                getVehicleRotation(prev.angle, prevX, prevY),
                                getVehicleRotation(angle, x, y)
                            );
                        });

                    //update counter for HTML update
                    //countByDir.push(v.dirTag);

                } else {
                    //case 2 - turn the vehicle to the normal status
                    d3.select('.js-loc-' + route.tag + '-' + id)
                        .style('stroke', 'black');
                }
            } else {
                //case 3 - draw added vehicles
                drawVehicleShape(route.tag, v.dirTag, id, x, y, v.angle, route.color);
            }
        });

        //case 4 - remove vehicles that are not seen in the new data
        _.each(_.difference(oldIds, _.keys(data)), function (id) {
            d3.select('.js-loc-' + route.tag + '-' + id).remove();
        });

        //update vehicle ID info
        selectedRoutes[route.tag] = data;
    }

    function highlightRoute(route) {
        d3.selectAll('.js-routes-' + route.tag)
            .style('stroke', route.color)
            .style('opacity', 1);
    }

    this.showVehiclesLocation = function (data, route) {

        highlightRoute(route);

        //check if the route is called first (initial call from setTimeout)
        //then update the vehicles, not draw
        if (_.contains(_.keys(selectedRoutes), route.tag)) {
            updateVehiclesLocation(data, route);
            return false;
        }

        //called for the first time -- raise to the top
        console.log('---draw initial location for', route.tag);
        d3.selectAll('.js-routes-' + route.tag).raise();

        //draw vehicle as triangle - top is the direction
        _.each(data, function (v, id) {
            var x = projection(v.coor)[0];
            var y = projection(v.coor)[1];
            drawVehicleShape(route.tag, v.dirTag, id, x, y, v.angle, route.color);
        });

        //update object of selected route
        selectedRoutes[route.tag] = data;
    };

    this.showEmptyRoute = function (route) {
        //highlight route path even if there's no vehicle returned
        highlightRoute(route);
        d3.selectAll('.js-loc-' + route.tag).remove();
        selectedRoutes[route.tag] = {};
    };

    this.removeRoute = function (tag) {
        d3.selectAll('.js-routes-' + tag).style('opacity', 0).lower();
        d3.selectAll('.js-loc-' + tag).remove();
        selectedRoutes = _.omit(selectedRoutes, tag);
    };

    this.toggleDirection = function (routeTag, dirTag, val) {

        //if val is true, hide all vehicles of the selected route
        var opacity = val ? 0 : 1;
        d3.selectAll('.js-loc-' + routeTag + '-' + dirTag).style('opacity', opacity);
    };

    return this;
}]);
