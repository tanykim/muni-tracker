
'use strict';

angular.module('trackerApp').factory('routeJsonGenerator', [
    '$window',
    '$http',
    '$q',
    'X2JS',
    '_', function ($window, $http, $q, X2JS, _) {

    //used only once to generate static datasets as a json file

    //base URL for API
    const URL = 'http://webservices.nextbus.com/service/publicXMLFeed';

    // jscs:disable
    var x2js = new X2JS();

    //route path infor as GeoJSON format
    function getPathList(pathes) {
        return _.map(pathes, function (p) {
            return {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: _.map(p.point, function (d) {
                        return [+d._lon, +d._lat];
                    })
                }
            };
        });
    }

    function getDirectionInfo(directions) {
        return _.map(directions, function (d) {
            // console.log(d.stop);
            return {
                tag: d._tag,
                title: d._title,
                name: d._name,
                stopCount: d.stop ? d.stop.length : 0
            };
        });
    }

    //get info of each stop from the list of stops
    function getStopsInfo(directions, stops) {

        //get which directions are related to the stop
        function getStopDirs(st) {
            return _.map(_.filter(directions, function (d) {
                return _.contains(_.pluck(d.stop, '_tag'), st);
            }), function (d) {
                return d._tag;
            });
        }

        var stopInfo = _.map(stops, function (s) {
            return {
                coordinates: [+s._lon, +s._lat],
                title: s._title,
                stopId: s._stopId,
                dir: getStopDirs(s._tag)
            };
        });
        return stopInfo;
    }

    function getRoutePaths(routes) {

        //parameters for API
        var routePaths = _.map(routes, function (r) {
            var params = {
                command: 'routeConfig',
                a: 'sf-muni',
                r: r
            };
            return $http.get(URL, { params: params });
        });

        //all XML from API
        $q.all(routePaths).then(function (xmlData) {

            console.log('--sucess: info of all routes');

            var allRoutesData = _.map(xmlData, function (d) {
                var routes = x2js.xml_str2json(d.data).body.route;
                return {
                    featureList: getPathList(routes.path),
                    tag: routes._tag,
                    title: routes._title.split('-')[1],
                    directions: getDirectionInfo(routes.direction),
                    stops: getStopsInfo(routes.direction, routes.stop)
                };
            });

            console.log('--dataset generation done');
            //copy the output to routes.json
            console.log(JSON.stringify(allRoutesData));
        });
    }

    this.getAllMuniRoutes = function () {
        $http.get(URL, {
            params: {
                command: 'routeList',
                a: 'sf-muni'
            }
        }).then(function (data) {

            console.log('--sucess: route list');

            var res = x2js.xml_str2json(data.data).body;
            var routes = _.map(angular.copy(res.route), function (d) {
                return d._tag;
            });
            getRoutePaths(routes);
        });
    };

    return this;
}]);
