'use strict';

angular.module('trackerApp').factory('routeManager', [
    '$window',
    '$http',
    '$q',
    'X2JS',
    '_', function ($window, $http, $q, X2JS, _) {

    //get all routes info from the static routes.json file
    this.getRoutesBaseInfo = function (routesData) {
        return _.map(routesData, function (route) {
            return {
                tag: route.tag,
                title: route.title,
                directions: route.directions,
                selected: false
            };
        });
    };

    function getRouteColor(routes) {

        //colors for route, set length = MAX_ROUTE_NUMBER
        var colors = ['#4A89DC', '#F6BB42', '#F26451', '#8CC152', '#967ADC'];
        var newColor = colors[_.size(routes) % colors.length];

        //check if any routes were deleted and assing non-used color
        var usedColors = _.pluck(routes, 'color');
        if (_.contains(usedColors, newColor)) {
            for (var i = 0; i < colors.length; i++) {
                if (!_.contains(usedColors, colors[i])) {
                    newColor = colors[i];
                    break;
                }
            }
        }
        return newColor;
    }

    //initiate new route object when user selects a route
    this.initNewRoute = function (id, tag, baseInfo, routes) {

        var color = getRouteColor(routes);

        return {
            tag: tag,
            title: baseInfo.title,
            directions: _.object(_.sortBy(_.map(angular.copy(baseInfo.directions), function (d) {
                return [ d.tag, {
                    name: d.name,
                    title: d.title,
                    isHidden: false,
                    count: 0,
                    updated: 0,
                    stopCount: d.stopCount
                }];
            }), function (d) {
                return d.name;
            })),
            color: color,
            na: true,
            id: id
        };
    };

    function getVehicleInfo(vehicles) {
        return _.object(_.map(vehicles, function (v) {
            return [ v._id, {
                coor: [+v._lon, +v._lat],
                angle: +v._heading,
                dirTag: v._dirTag
            }];
        }));
    }

    function updateRouteProperties(route, vehicles, ids) {

        //count of all vehicles and animdated ones by direction
        var byDirection = _.object(_.map(_.groupBy(vehicles, function (v) {
                return v._dirTag;
            }), function (vlist, dirTag) {
                return [ dirTag, {
                    count: vlist.length,
                    updated: _.size(_.intersection(_.pluck(vlist, '_id'), ids))
                }];
            }));

        _.each(byDirection, function (d, dirTag) {
            route.directions[dirTag].count = d.count;
            route.directions[dirTag].updated = d.updated;
        });
        route.na = false;
    }

    function setErrorCase(route, errorDrawer) {
        errorDrawer(route);
        route.na = true;
    }

    this.getRouteLocation = function (route, mapDrawer) {

        //base URL for API
        var URL = 'http://webservices.nextbus.com/service/publicXMLFeed';
        var x2js = new X2JS();

        $http.get(URL, {
            params: {
                command: 'vehicleLocations',
                a: 'sf-muni',
                r: route.tag
            }
        }).then(function (data) {

            // jscs: disable
            var res = x2js.xml_str2json(data.data).body;

            //vehicles that does not have "_dirTag" are ommitted assuming there are not in service
            //consider only vehicles whose direction matches from the base route info
            var validVehicles = _.filter(res.vehicle, function (v) {
                return _.contains(_.keys(route.directions), v._dirTag);
            });
            if (!_.isEmpty(validVehicles)) {

                //vehicle info object for vis
                var vehicleInfo = getVehicleInfo(validVehicles);

                //check if the route is already drawn in the vis
                var updatedVehicles = mapDrawer.getUpdatedVehicles(vehicleInfo, route.tag);

                //initiate vehicle visualization
                if (!updatedVehicles) {
                    mapDrawer.showVehiclesLocation(vehicleInfo, route);
                } else {
                    mapDrawer.updateVehiclesLocation(vehicleInfo, route);
                }

                //update route model
                updateRouteProperties(route, validVehicles, updatedVehicles);

            } else {
                setErrorCase(route, mapDrawer.showEmptyRoute);
            }
        }, function () {
            setErrorCase(route, mapDrawer.showEmptyRoute);
        });
    };

    return this;
}]);
