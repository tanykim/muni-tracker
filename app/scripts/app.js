'use strict';

/**
* @ngdoc overview
* @name 365daysApp
* @description
* # 365daysApp
*
* Main module of the application.
*/
angular.module('d3', []).factory('d3', ['$window', function ($window) {
    return $window.d3;
}]);
angular.module('X2JS', []).factory('X2JS', ['$window', function ($window) {
    return $window.X2JS;
}]);
angular.module('trackerApp', [
    'ngRoute',
    'ui.bootstrap',
    'underscore',
    'd3',
    'X2JS'
])
.config(function ($routeProvider) {
    $routeProvider
    .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        controllerAs: 'main'
    })
    .otherwise({
        redirectTo: '/'
    });
});


