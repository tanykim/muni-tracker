'use strict';

angular.module('trackerApp').factory('routeDataGenerator', [
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
        $q.all(routePaths).then(function (res) {
            var allRoutesData = _.map(res, function (d) {
                var res = x2js.xml_str2json(d.data).body;
                return {
                    tag: res.route._tag,
                    title: res.route._title.split('-')[1],
                    path: res.route.path,
                    directions: _.map(res.route.direction, function (d) {
                        return {
                            tag: d._tag,
                            name: d._name,
                            title: d._title
                        };
                    }),
                    stops: _.map(res.route.stop, function (d) {
                        return {
                            lat: d._lat,
                            lon: d._lon,
                            stopId: d._stopId,
                            tag: d._tag,
                            title: d._title
                            //TODO: add direction of stops
                        };
                    })
                };
            });

            var geoJsonList = _.map(allRoutesData, function (routeData) {
                var featureList = _.map(routeData.path, function (p, i) {
                    var coorList = _.map(p.point, function (d) {
                        return [+d._lon, +d._lat];
                    });
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: coorList
                        },
                        properties: {
                            dirTag: routeData.directions[i].tag
                        }
                    };
                });

                return {
                    tag: routeData.tag,
                    title: routeData.title,
                    featureList: featureList,
                    directions: routeData.directions,
                    stops: routeData.stops
                };
            });
            //copy the output to routes.json
            console.log(JSON.stringify(geoJsonList));
        });
    }

    this.getAllMuniRoutes = function () {
        $http.get(URL, {
            params: {
                command: 'routeList',
                a: 'sf-muni'
            }
        }).then(function (data) {
            var res = x2js.xml_str2json(data.data).body;
            var routes = _.map(angular.copy(res.route), function (d) {
                return d._tag;
            });
            getRoutePaths(routes);
        });
    };

    return this;
}]);
