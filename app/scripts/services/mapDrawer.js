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
            .attr('class', 'js-nh pos-middel size-tiny');
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

    function getRoutesInfo(data) {
        return _.map(data, function (route) {
            return {
                tag: route.tag,
                title: route.title,
                directions: route.directions,
                selected: false
            };
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
            //TODO: panning limit
            svg.append('rect')
                .attr('width', dim.w)
                .attr('height', dim.h)
                .style('fill', 'none')
                .style('pointer-events', 'all')
                .call(d3.zoom()
                    .scaleExtent([1, 8])
                    .on('zoom', zoomed));

            //get objects of routes info used for HTML/main.js
            var routesInfo = getRoutesInfo(res[2].data);

            loadingDoneCallback(routesInfo);
        });
    };
    /* end of base map */

    //location, angle, id of each vehicle by route tag
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

    function setVehicleInfo(prop, x, y) {
        var angleById = _.zip(prop.vehicleIds, prop.angles);
        return _.object(_.map(angleById, function (d) {
                return [d[0], { angle: d[1], x: x, y: y }];
            }));
    }

    function drawVehicleShape(angle, x, y, dirTag, route, id) {

        //vehicle triangle - rotate according to the angle
        vis.append('path')
            .attr('d', getVehicleShape(x, y))
            .attr('transform', getVehicleRotation(angle, x, y))
            .style('fill', route.color)
            .style('stroke', 'black')
            .attr('class', 'js-loc-' + route.tag + //used for add/remove of the route
                ' js-loc-' + route.tag + '-' + id + //for transition
                ' js-loc-' + route.tag + '-' + dirTag); //for direction toggle
    }

    function updateVehiclesLocation(data, route) {

        //when new data is successfully gotten
        if (!_.isNull(data)) {

            var oldIds = _.keys(selectedRoutes[route.tag]);
            var newIds = data.properties.vehicleIds;

            //all vehicle IDs from the new data
            var newIdsInfo = setVehicleInfo(data.properties, null, null);
            _.each(newIds, function (id, i) {

                //stop points
                var stops = data.geometry.coordinates[i];
                var x = projection(stops)[0];
                var y = projection(stops)[1];
                var angle = +data.properties.angles[i];

                //vehicles with the ID is drawn previously
                if (_.contains(oldIds, id)) {

                    //previous angle, x, y of the ID - used for correct transition
                    var prev = selectedRoutes[route.tag][id];

                    //set transition only if the position changes
                    //TODO: enhance the style of transition
                    if (prev.x !== x || prev.y !== y) {
                        d3.select('.js-loc-' + route.tag + '-' + id)
                            .style('stroke', 'red')
                            .transition()
                            .attrTween('d', function () {
                                return d3.interpolateString(
                                    getVehicleShape(prev.x, prev.y),
                                    getVehicleShape(x, y)
                                );
                            })
                            .attrTween('transform', function () {
                                return d3.interpolateString(
                                    getVehicleRotation(prev.angle, prev.x, prev.y),
                                    getVehicleRotation(angle, x, y)
                                );
                            });
                    } else {
                        d3.select('.js-loc-' + route.tag + '-' + id)
                            .style('stroke', 'black');
                    }
                } else {
                    //draw new vehicle
                    drawVehicleShape(angle, x, y, data.properties.dirTags[i], route, id);
                }
                newIdsInfo[id].x = x;
                newIdsInfo[id].y = y;
            });

            //update vehicle ID info
            selectedRoutes[route.tag] = newIdsInfo;

            //remove vehicles that are not seen in the new data
            _.each(_.difference(oldIds, newIds), function (id) {
                d3.select('.js-loc-' + route.tag + '-' + id).remove();
            });

        } else {
            //remove previously drawn locations and make vehicleIds empty
            d3.selectAll('.js-loc-' + route.tag).remove();
            selectedRoutes[route.tag] = {};
        }

    }

    this.drawVehiclesLocation = function (data, route) {

        //highlight route path even if there's no vehicle returned
        d3.selectAll('.js-routes-' + route.tag)
            .style('stroke', route.color)
            .style('opacity', 1);

        //draw vehicle only when data update is successful
        if (!_.isNull(data)) {

            //check if the route is called first (initial call from setTimeout)
            //then update the vehicles, not draw
            if (_.contains(_.keys(selectedRoutes), route.tag)) {
                //show the route animation of the vehicle location change
                //console.log('---already called', route.tag);
                updateVehiclesLocation(data, route);
                return false;
            }

            //called for the first time -- raise to the top
            console.log('---draw initial location for', route.tag);
            d3.selectAll('.js-routes-' + route.tag).raise();

            //update object of selected route
            selectedRoutes[route.tag] = setVehicleInfo(data.properties, null, null);

            _.each(data.geometry.coordinates, function (stops, i) {

                //stop points
                var x = projection(stops)[0];
                var y = projection(stops)[1];
                var id = data.properties.vehicleIds[i];
                //add x, y position to the route info
                selectedRoutes[route.tag][id].x = x;
                selectedRoutes[route.tag][id].y = y;

                //draw vehicle as triangle - top is the direction
                drawVehicleShape(+data.properties.angles[i], x, y, data.properties.dirTags[i],
                    route, id);
            });
        }
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
