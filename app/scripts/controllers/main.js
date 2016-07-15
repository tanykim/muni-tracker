'use strict';

angular.module('trackerApp').controller('MainCtrl', [
    '$scope', '$location', '$window', '$http', '_', 'mapDrawer', 'dataLoader', 'routeDataGenerator',
    function ($scope, $location, $window, $http, _, mapDrawer, dataLoader, routeDataGenerator) {

        /****
        //generate route data only once
        //this creates base map data (route.json) should be generated
        ****/
        $http.get('data/routes.json').error(function () {
            routeDataGenerator.getAllMuniRoutes();
            return false;
        });

        /****
        //controls user interface and route vis
        *****/

        const MAX_ROUTE_NUMBER = 5;
        $scope.maxRouteNum = MAX_ROUTE_NUMBER;
        //colors for route;
        var colors = ['#4A89DC', '#DA4453', '#37BC9B', '#F6BB42', '#8CC152'];

        //selected Routes - generated from routes.json
        //used in mapDrawer
        $scope.selectedRoutes = [];

        //setTimeout variables for each route
        var callAPIsetTimeouts = {};

        $scope.selectRoute = function (id, tag) {

            //when more than max routes are selected
            if ($scope.selectedRoutes.length === $scope.maxRouteNum) {
                $scope.error = true;
                $scope.errorMsg = 'Remove one of the selected route before you select a new one.';
                return false;
            }

            //get route info from all routes
            var routeInfo = _.filter($scope.allRoutes, function (r) {
                return r.tag === tag;
            })[0];

            var newColor = colors[_.size($scope.selectedRoutes) % colors.length];
            //check if any routes were deleted and assing non-used color
            var usedColors = _.pluck($scope.selectedRoutes, 'color');
            if (_.contains(usedColors, newColor)) {
                for (var i = 0; i < colors.length; i++) {
                    if (!_.contains(usedColors, colors[i])) {
                        newColor = colors[i];
                        break;
                    }
                }
            }

            //make a new route object
            var newRoute = {
                tag: tag,
                title: routeInfo.title,
                countByDir: _.object(_.map(angular.copy(routeInfo.directions), function (d) {
                    return [d.tag, { name: d.name, count: 0, isHidden: false }];
                })),
                color: newColor,
                id: id
            };
            $scope.selectedRoutes.push(newRoute);
            $scope.allRoutes[id].selected = true;

            //call API every 15 seconds
            (function callAPI() {
                console.log(tag);
                dataLoader.getRouteLocation(newRoute, mapDrawer.drawVehiclesLocation);
                callAPIsetTimeouts[tag] = setTimeout(callAPI, 2000);
            })();

        };

        $scope.removeRoute = function (id, tag) {

            //stop the setTimeout
            clearTimeout(callAPIsetTimeouts[tag]);

            //remove the selected route
            $scope.selectedRoutes = _.filter($scope.selectedRoutes, function (route) {
                return route.tag !== tag;
            });
            //because now the number of selected routes is alreays less than 5
            $scope.error = false;

            //unmark deselected routes from the route list
            for (var i = 0; i < $scope.allRoutes.length; i++) {
                if ($scope.allRoutes[i].tag === tag) {
                    $scope.allRoutes[i].selected = false;
                    break;
                }
            }
            //update map
            mapDrawer.removeRoute(tag);
        };

        $scope.toggleDirection = function (id, routeTag, dirTag, val) {
            $scope.selectedRoutes[id].countByDir[dirTag].isHidden = val;
            mapDrawer.toggleDirection(routeTag, dirTag, val);
        };

        //when loading is done --> set all routes, draw route location, update route info
        function setLoadingDone(routes) {

            $scope.allRoutes = routes;

            //update route location and info one by one
            if (_.isEmpty($scope.selectedRoutes)) {
                _.each($scope.selectedRoutes, function (route) {
                    dataLoader.getRouteLocation(route, mapDrawer.drawRouteLocation);
                });
            }
            $scope.loadingDone = true;
        }

        //draw map - streets, neighborhoodname, and pathes of all routes
        mapDrawer.loadBaseMap(setLoadingDone);
}]);
