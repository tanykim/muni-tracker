
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

    //get info of each stop from the list of stops
    function getStopInfo(stopTag, stops) {
        var stopInfo;
        for (var i = 0; i < stops.length; i++) {
            if (stops[i]._tag === stopTag) {
                stopInfo = stops[i];
                break;
            }
        }
        return stopInfo;
    }

    //multiple directions of one route including stop info
    function getDirectionWithStopInfo(directions, stops) {
        return _.map(directions, function (d) {
            return {
                tag: d._tag,
                name: d._name,
                title: d._title,
                stops: _.map(stops, function (s) {
                    var stopInfo = getStopInfo(s._tag, stops);
                    return {
                        coordinates: [+stopInfo._lon, +stopInfo._lat],
                        title: stopInfo._title
                    };
                })
            };
        });
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
                    directions: getDirectionWithStopInfo(routes.direction, routes.stop)
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
