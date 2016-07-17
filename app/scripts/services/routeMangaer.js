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

    //initiate new route object when user selects a route
    this.initNewRoute = function (id, tag, baseInfo, selectedRoutes) {

        //colors for route, set length = MAX_ROUTE_NUMBER
        var colors = ['#4A89DC', '#F6BB42', '#F26451', '#8CC152', '#967ADC'];
        var newColor = colors[_.size(selectedRoutes) % colors.length];

        //check if any routes were deleted and assing non-used color
        var usedColors = _.pluck(selectedRoutes, 'color');
        if (_.contains(usedColors, newColor)) {
            for (var i = 0; i < colors.length; i++) {
                if (!_.contains(usedColors, colors[i])) {
                    newColor = colors[i];
                    break;
                }
            }
        }

        return {
            tag: tag,
            title: baseInfo.title,
            directions: _.object(_.sortBy(_.map(angular.copy(baseInfo.directions), function (d) {
                return [ d.tag, {
                    name: d.name,
                    isHidden: false,
                    count: 0,
                }];
            }), function (d) {
                return d.name;
            })),
            color: newColor,
            na: true,
            id: id,
            isUpdated: false
        };
    };

    function getVehicleInfo(validVehicles) {
        return _.object(_.map(validVehicles, function (v) {
            return [ v._id, {
                coor: [+v._lon, +v._lat],
                angle: +v._heading,
                dirTag: v._dirTag
            }];
        }));
    }

    function updateRouteProperties(selectedRoute, validVehicles, frequency) {

        //update count by direction
        var byDirection = _.groupBy(validVehicles, function (v) {
                return v._dirTag;
            });
        _.each(byDirection, function (array, tag) {
            if (selectedRoute.directions[tag]) {
                selectedRoute.directions[tag].count = array.length;
            }
        });
        selectedRoute.na = false;

        //updated status - show refresh sign for 1/3 of frequency seconds
        selectedRoute.isUpdated = true;
        var resetStatus = function () {
            selectedRoute.isUpdated = false;
        };
        _.delay(resetStatus, frequency / 3);
    }

    function setErrorCase(selectedRoute, errorDrawer) {
        errorDrawer(selectedRoute);
        selectedRoute.na = true;
    }

    this.getRouteLocation = function (selectedRoute, frequency, visDrawer, errorDrawer) {

        //base URL for API
        const URL = 'http://webservices.nextbus.com/service/publicXMLFeed';
        var x2js = new X2JS();

        $http.get(URL, {
            params: {
                command: 'vehicleLocations',
                a: 'sf-muni',
                r: selectedRoute.tag,
                //t: lastTime
            }
        }).then(function (data) {

            // jscs: disable
            var res = x2js.xml_str2json(data.data).body;

            //vehicles that does not have "_dirTag" are ommitted assuming there are not in service
            //consider only vehicles whose direction matches from the base route info
            var validVehicles = _.filter(res.vehicle, function (v) {
                return _.contains(_.keys(selectedRoute.directions), v._dirTag);
            });
            if (!_.isEmpty(validVehicles)) {

                //vehicle info object for vis
                var vehicleInfo = getVehicleInfo(validVehicles);

                //draw vehicle visualization
                visDrawer(vehicleInfo, selectedRoute);
                //update route model
                updateRouteProperties(selectedRoute, validVehicles, frequency);

            } else {
                setErrorCase(selectedRoute, errorDrawer);
            }
        }, function () {
            setErrorCase(selectedRoute, errorDrawer);
        });
    };

    return this;
}]);
