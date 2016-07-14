'use strict';

angular.module('trackerApp').factory('mapDrawer', [
    '$window',
    '$http',
    '$q',
    '_',
    'd3', function ($window, $http, $q, _, d3) {

    //canvas and geoPath used for all
    var dim, vis, projection, path;

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

    //draw pathes of all routes as transparent stroke
    function drawRoutes(data) {
        _.each(data, function (route) {
            vis.selectAll('.js-routes-' + route.tag)
                .data(route.featureList)
                .enter()
                .append('path')
                .attr('d', path)
                .style('fill', 'none')
                .style('opacity', 0)
                .attr('class', 'js-routes-' + route.tag);
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

    function zoomed() {
        vis.attr('transform', d3.event.transform);
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

            var routesInfo = getRoutesInfo(res[2].data);

            loadingDoneCallback(routesInfo);
        });
    };

    this.drawRouteLocation = function (data, route) {

        //highlight route path
        d3.selectAll('.js-routes-' + route.tag)
            .style('stroke', route.color)
            .style('opacity', 1)
            .raise();

        //TODO: add data-value or i as stop ID
        //draw vehicle when data update is successful
        if (!_.isNull(data)) {
            _.each(data.geometry.coordinates, function (stops, i) {

                var x = projection(stops)[0];
                var y = projection(stops)[1];

                //TODO: draw shape to reflect the direction??
                // var angle = +data.properties.angle[i];
                // var sp = 'M ' + x + ' ' + y;
                // var center = 4;
                // var side = Math.sqrt(center * center * 4 / 5);
                // vis.append('path')
                //     .attr('d', function () {
                //         return sp + ' v ' + -center + ' l ' + side + ' ' + (center + side / 2) +
                //             ' h ' + -side * 2 +
                //             ' l ' + side + ' ' + -(center + side / 2);
                //     })
                //     .attr('transform', 'rotate(' + angle + ' ' +
                //         (x + side / 2) + ' ' + (y + side / 2) + ')')
                //     .attr('fill', route.color)
                //     .attr('class', 'js-location-' + route.tag + ' js-location-' + route.tag + '-' + i);

                vis.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 2)
                    .style('fill', route.color)
                    .style('stroke', 'black')
                    .attr('class', 'js-location-' + route.tag + ' js-location-' + route.tag + '-' + i);
            });
        }
    };

    this.removeRoute = function (tag) {
        d3.selectAll('.js-routes-' + tag).style('opacity', 0).lower();
        d3.selectAll('.js-location-' + tag).remove();
    };

    return this;
}]);
