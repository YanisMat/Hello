var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Generic Area Graph module.
 *
 *** Exemplary usage:

var config = {
  container: document.getElementById('area-graph'),
  data: {
    // Make sure the classNames and area arrays have the same length!
    // The order of classNames matches with the order of areas.
    areaMeta: ['', { classNames: 'area--blue-light' }, { classNames: 'area--green-dark' }, { classNames: 'area--blue-light-dotted' }, { classNames: 'area--green-light' }, { classNames: 'area--blue-dark-dotted' }],
    areas
  }
};

var myAreaGraph = new AreaGraph(config);

 *** Public methods:

areaGraph.update({
  areas: areas2,
  areaMeta: [{ classNames: 'area--blue-light' }, '', { classNames: 'area--green-dark' }]
});

 *** Conventions:

 - "px": Format: {x: <xValue>, y: <yValue>}. Position in the chart element. Uses absolute pixel values (e.g. 1080 in a 1200px-wide element).
 - "point": Format: {x: <xValue>, y: <yValue>}. Coordinates within chart. Relative values depending on the chart range (e.g. 14.3 in a range of 20).
 - "render...()". Indicates that a part of the graph is to be drawn.

 */

/**
 * Generic functions used by Area Graph.
 */

/**
 * Returns the maximum value in the given area
 */
var stackMax = function stackMax(area) {
  return d3.max(area, function (d) {
    return d[1];
  });
};

/**
 * Returns the minimum value in the given area
 */
var stackMin = function stackMin(area) {
  return d3.min(area, function (d) {
    return d[0];
  });
};

/**
 * Get closest x value in dataset left of/small than reference point
 *
 * @param {array} data
 * @param {integer} referencePointX
 *
 * @returns {object} {x: <xValue>, y: <yValue>}
 */
var findClosestPointLeft = function findClosestPointLeft(data, referencePointX) {
  return data.reduce(function (accumulator, currentValue, currentIndex) {
    // NOTE The current algorithm only works if the "currentValue.coords.x" values are sorted in an ascending order, e.g. 0, 1, 2, ...
    var closestXValue = currentValue.coords.x;

    // Read: If currentValue is smaller than (left of) cursor but higher than the last value, then ...
    return closestXValue < referencePointX && closestXValue >= accumulator.coords.x ? currentValue : accumulator;
  });
};

/**
 * Get closest x value in dataset right of/bigger than reference point
 *
 * @param {array} data
 * @param {integer} referencePointX
 *
 * @returns {object} {x: <xValue>, y: <yValue>}
 */
var findClosestPointRight = function findClosestPointRight(data, referencePointX) {
  return data.reduceRight(function (accumulator, currentValue, currentIndex) {
    // NOTE The current algorithm only works if the "currentValue.coords.x" values are sorted in a descending order, e.g. 9, 8, 7, ...
    var closestXValue = currentValue.coords.x;

    // Read: If currentValue is bigger than (right of) cursor OR EQUAL but smaller than the last value, then ...
    return closestXValue >= referencePointX && closestXValue <= accumulator.coords.x ? currentValue : accumulator;
  });
};

/**
 * Determine point where curve intersects with vertical line
 *
 * @param {integer} left Left/minimum position in curve
 * @param {integer} right Right/maximum position in curve
 * @param {object} xValue X-value of vertical line that intersects with curve
 * @param {function} pointFunc Function called to determine point on curve at certain length of the curve
 *
 * @returns {object} {x: <xValue>, y: <yValue>}
 */
var findClosestPointVertically = function findClosestPointVerticallyR(left, right, xValue, pointFunc) {
  // The higher the precision, the more computing power is needed, and the closer the point will match with the visible intersection
  var precision = 0.5;

  // Critical part of algorithm to reduce needed steps to find y-value
  var split = (left + right) / 2;

  // Point on curve (approximate value)
  var curvePoint = pointFunc(split);

  // Distance between curve's approximate point.x and xValue
  var distance = Math.abs(right - left);

  // If the two x-values are close enough, we use the determined point on the curve
  if (distance <= precision) {
    return curvePoint;
  }

  if (curvePoint.x <= xValue) {
    return findClosestPointVerticallyR.call(this, split, right, xValue, pointFunc);
  } else {
    return findClosestPointVerticallyR.call(this, left, split, xValue, pointFunc);
  }
};

var defaults = {
  attributeNames: {
    areaBorderId: 'data-area-id'
  },
  classNames: {
    svg: 'svg-content',
    area: 'area',
    areaBorder: 'border',
    highlight: {
      circle: 'highlight highlight__circle',
      path: 'highlight highlight__path border border--highlight'
    }
  },
  ids: {
    mask: {
      highlightPath: 'maskHighlightPath'
    }
  },
  /**
   * Documentation: https://github.com/d3/d3-shape/blob/master/README.md#curves
   * Tool for curve comparison: https://cemrajc.github.io/d3-curve-comparison/
   * Alternatives:
   * - d3.curveCatmullRom.alpha(0.5)
   * - d3.curveLinear
   */
  areaCurve: d3.curveBasis
};

var AreaGraph = function () {
  function AreaGraph(config) {
    _classCallCheck(this, AreaGraph);

    this.config = _extends({}, defaults, config);
    this.data = config.data;

    this.init();

    return {
      update: this.update.bind(this)
    };
  }

  _createClass(AreaGraph, [{
    key: 'updateChartSize',
    value: function updateChartSize() {
      this.chart.attr('height', this.config.container.clientHeight).attr('width', this.config.container.clientWidth);
    }
  }, {
    key: 'handleResize',
    value: function handleResize() {
      var _this = this;

      window.requestAnimationFrame(function () {
        _this.clear();
        _this.render();
      });
    }
  }, {
    key: 'clear',
    value: function clear() {
      d3.selectAll(this.config.container.childNodes).remove();
    }
  }, {
    key: 'init',
    value: function init() {
      this.stack = this.updateStack();
      this.render();
      window.addEventListener('resize', this.handleResize.bind(this));
    }
  }, {
    key: 'updateStack',
    value: function updateStack() {
      var _this2 = this;

      var stack = d3.stack().keys(d3.range(this.areaCount()))
      // Applies a zero baseline (https://github.com/d3/d3-shape/blob/master/README.md#stackOffsetNone)
      .offset(d3.stackOffsetNone);

      var transposedStack = stack(d3.transpose(this.data.areas));

      var fullStack = transposedStack.map(function (arrays, areaIndex) {
        // TODO Set initial chart width instead of calling "clientWidth" twice (once here, once in updateChartSize)
        var chartWidth = _this2.config.container.clientWidth;

        return arrays.map(function (currentValue, index, array) {
          // Calculate x coordinate assuming the values are spread evently along the x-axis
          var xPosition = index === 0 ? 0 : chartWidth / _this2.xAxisSectionCount() * index;

          /**
           * Coordinates are relative to the coordinate system and independent from the chart's pixel size and areas.
           */
          currentValue.coords = {
            x: _this2.xScale().invert(xPosition),
            y: currentValue[1]
          };

          // Here we add meta data to each area.
          // This data can be accessed from every area!
          // This is useful to provide area-specific tooltip texts, for example.
          currentValue.meta = _this2.data.areaMeta[areaIndex];
          return currentValue;
        });
      });

      return fullStack;
    }
  }, {
    key: 'areaCount',
    value: function areaCount() {
      return this.data.areas.length;
    }
  }, {
    key: 'xAxisSectionCount',
    value: function xAxisSectionCount() {
      return this.data.areas[0].length - 1;
    }

    /**
     * Constructs scale along x-axis
     */

  }, {
    key: 'xScale',
    value: function xScale() {
      var width = this.config.container.clientWidth;

      return d3.scaleLinear()
      // Check for amount of entries in first areas
      // If other areas have more entries, they'll be cut off.
      // So make sure that all areas have the same amount of entries!
      .domain([0, this.xAxisSectionCount()]).range([0, width]);
    }

    /**
     * Constructs scale along y-axis
     */

  }, {
    key: 'yScale',
    value: function yScale() {
      var height = this.config.container.clientHeight;

      return d3.scaleLinear().domain([d3.min(this.stack, stackMin), d3.max(this.stack, stackMax)]).range([height, 5]);
    }
  }, {
    key: 'unhighlightSection',
    value: function unhighlightSection() {
      var _this3 = this;

      var draw = function draw() {
        _this3.removeLayer('highlights');
      };

      window.requestAnimationFrame(draw.bind(this));
    }

    /**
     * Get position of x/y in coordinate system.
     * This method expects pixel values and returns values relative to the coordinate system.
     *
     * @param {object} coords {x, y}
     *
     * @returns {object} {x, y}
     */

  }, {
    key: 'convertPxToPoint',
    value: function convertPxToPoint(coords) {
      return {
        x: this.xScale().invert(coords.x),
        y: this.yScale().invert(coords.y)
      };
    }
  }, {
    key: 'pointOnCurveInPx',
    value: function pointOnCurveInPx(curve, length) {
      return curve.getPointAtLength(length);
    }

    /**
     * Get pixel position of x/y within chart element.
     * This method expects coordinate values and returns absolute values within the currently displayed element.
     *
     * @param {object} coords {x, y}
     *
     * @returns {object} {x, y}
     */

  }, {
    key: 'convertPointToPx',
    value: function convertPointToPx(coords) {
      return {
        x: this.xScale()(coords.x),
        y: this.yScale()(coords.y)
      };
    }

    /**
     * Calculate point on curve that's as close to a certain point as possible
     */

  }, {
    key: 'calculateClosestPoint',
    value: function calculateClosestPoint(curve, idealPoint) {
      var _this4 = this;

      var pointOnCurve = function pointOnCurve(length) {
        return _this4.convertPxToPoint(_this4.pointOnCurveInPx(curve, length));
      };

      var curveStart = 0;
      var curveEnd = curve.getTotalLength();

      return findClosestPointVertically.call(this, curveStart, curveEnd, idealPoint.x, pointOnCurve);
    }

    /**
     * Highlight point at certain position
     *
     * @param {object} position {x, y}
     * @param {object} layer D3 element
     */

  }, {
    key: 'renderHighlightCircle',
    value: function renderHighlightCircle(layer, position) {
      layer.append('circle').classed(this.config.classNames.highlight.circle, true).attr('cx', function () {
        return position.x;
      }).attr('cy', function () {
        return position.y;
      }).attr('r', 6);
    }
  }, {
    key: 'renderMask',
    value: function renderMask(config) {
      var selectMask = d3.select('#' + this.config.ids.mask.highlightPath);
      var maskContainer = void 0;

      if (selectMask.empty()) {
        maskContainer = this.addLayer('masks').append('svg').attr('height', '100%').attr('width', '100%').append('defs').append('mask').attr('id', this.config.ids.mask.highlightPath);
      } else {
        selectMask.select('rect').remove();
        maskContainer = selectMask;
      }

      maskContainer.append('rect').attr('x', config.boundary.left).attr('y', 0).attr('height', '100%').attr('width', config.boundary.right - config.boundary.left).attr('fill', 'transparent');
    }
  }, {
    key: 'renderHighlightPath',
    value: function renderHighlightPath(layer, index, maskConfig) {
      this.renderMask(maskConfig);

      var border = this.curveAreaBorder();

      var path = layer.selectAll('g.child').data([this.stack[index]]).enter().append('path').classed(this.config.classNames.highlight.path, true)
      // Make sure the mask element exists on the page!
      .attr('mask', 'url("#' + this.config.ids.mask.highlightPath + '")').attr('d', border);
    }
  }, {
    key: 'highlightSection',
    value: function highlightSection(d, i) {
      var _this5 = this;

      var cursor = {
        x: d3.mouse(this.config.container)[0], // Pixel position
        y: d3.mouse(this.config.container)[1]
      };

      var cursorCoords = this.convertPxToPoint({
        x: cursor.x,
        y: cursor.y
      });

      var border = this.getBorderOfArea(i);

      var idealPointLeft = findClosestPointLeft(d, cursorCoords.x).coords;
      var closestPointLeft = this.calculateClosestPoint(border, idealPointLeft);

      var idealPointRight = findClosestPointRight(d, cursorCoords.x).coords;
      var closestPointRight = this.calculateClosestPoint(border, idealPointRight);

      var maskConfig = {
        boundary: {
          left: this.convertPointToPx(idealPointLeft).x,
          right: this.convertPointToPx(idealPointRight).x
        }
      };

      // TODO Only redraw if position of highlight circles/highlighted curve changed (for performance reasons)
      window.requestAnimationFrame(function () {
        // NOTE Don't use `.unhighlight` here as long as `.unhighlight` also waits for `requestAnimationFrame`,
        // otherwise the newly drawn elements will disappear on the next frame.
        _this5.removeLayer('highlights');

        var layer = _this5.addLayer('highlights');

        _this5.renderHighlightPath(layer, i, maskConfig);

        // LEFT CIRCLE
        _this5.renderHighlightCircle(layer, {
          x: _this5.convertPointToPx(idealPointLeft).x,
          y: _this5.convertPointToPx(closestPointLeft).y
        });

        // RIGHT CIRCLE
        _this5.renderHighlightCircle(layer, {
          x: _this5.convertPointToPx(idealPointRight).x,
          y: _this5.convertPointToPx(closestPointRight).y
        });
      });
    }
  }, {
    key: 'handleMouseMove',
    value: function handleMouseMove(d, i) {
      this.highlightSection(d, i);
    }
  }, {
    key: 'handleMouseOver',
    value: function handleMouseOver(d, i) {
      this.highlightSection(d, i);
    }
  }, {
    key: 'handleMouseOut',
    value: function handleMouseOut(d, i) {
      this.unhighlightSection();
    }

    /**
     * Group elements in layers to avoid unexpected overlaps from different elements
     * and to make it easier to remove elements associated with a certain layer.
     *
     * @param {string} name Name of layer
     *
     * @returns {object} Layer element
     */

  }, {
    key: 'addLayer',
    value: function addLayer(name) {
      return this.chart.append('g').classed('layer layer__' + name, true);
    }
  }, {
    key: 'removeLayer',
    value: function removeLayer(name) {
      this.chart.selectAll('.layer__' + name).remove();
    }

    /**
     * Path to be followed when drawing an area.
     *
     * @returns {function}
     */

  }, {
    key: 'curveArea',
    value: function curveArea() {
      var _this6 = this;

      return d3.area().curve(this.config.areaCurve).x(function (d, i) {
        return _this6.xScale()(i);
      }).y0(function (d) {
        return _this6.yScale()(d[0]);
      }).y1(function (d) {
        return _this6.yScale()(d[1]);
      });
    }

    /**
     * Path to be followed when drawing a line that mimics the top border of an area.
     *
     * @returns {function}
     */

  }, {
    key: 'curveAreaBorder',
    value: function curveAreaBorder() {
      var _this7 = this;

      return d3.line().x(function (d, i) {
        return _this7.xScale()(i);
      }).y(function (d) {
        return _this7.yScale()(d[1]);
      }).curve(this.config.areaCurve);
    }

    /**
     * Render graph with multiple layers
     */

  }, {
    key: 'render',
    value: function render() {
      this.chart = d3.select(this.config.container).append('svg').classed(this.config.classNames.svg, true);
      this.updateChartSize();

      // Add layer: Areas
      this.renderAreas();

      // Add layer: Borders for areas
      this.renderAreaBorders();

      // Add layer: Dividers
      // this.renderDividers();
    }
  }, {
    key: 'renderAreas',
    value: function renderAreas() {
      var area = this.curveArea();

      this.addLayer('areas')
      // Select all children from new layer
      .selectAll('g.child').data(this.stack).enter().append('path')
      // Add general CSS class to every path
      .classed(this.config.classNames.area, true).attr('d', area).on('mouseover', this.handleMouseOver.bind(this)).on('mousemove', this.handleMouseMove.bind(this)).on('mouseout', this.handleMouseOut.bind(this)).each(this.renderArea);
    }
  }, {
    key: 'renderAreaBorders',
    value: function renderAreaBorders() {
      var border = this.curveAreaBorder();

      this.addLayer('borders').selectAll('g.child').data(this.stack).enter().append('path').classed(this.config.classNames.areaBorder, true).attr('d', border);
      // .each(this.renderBorder)
    }
  }, {
    key: 'getBorderOfArea',
    value: function getBorderOfArea(index) {
      // TODO Instead of relying on an index that that borders and areas have the same order, use identifiers added to borders and areas
      var area = document.querySelectorAll('.layer__borders path')[index]; // + 1

      return area;
    }
  }, {
    key: 'renderDividers',
    value: function renderDividers() {
      this.addLayer('dividers').selectAll('g.child').data(this.data.areas[0]).enter().append('g').each(this.renderDivider.bind(this));
    }
  }, {
    key: 'renderDivider',
    value: function renderDivider(dataset, index, dividers) {
      var divider = d3.select(dividers[index]);
      var dividerCount = this.xAxisSectionCount();
      var width = this.xScale().range()[1];

      divider.classed('divider', true).attr('transform', 'translate(' + width / dividerCount * index + ' 0)');

      if (index === 0) {
        divider.classed('divider--first', true);
      } else if (index === dividerCount) {
        divider.classed('divider--last', true);
      }

      divider.append('line').attr('y1', this.yScale().range()[0]).attr('y2', this.yScale().range()[1]).attr('stroke', '#f1f1f1').attr('stroke-width', '1');
    }
  }, {
    key: 'renderArea',
    value: function renderArea(d, i) {
      var classNames = d[i] && d[i].meta && d[i].meta.classNames || '';

      d3.select(this).classed(classNames, true);
    }

    /**
     * Update graph with new data.
     * Supports partial updates:
     * If only new area values with no area classNames are provided (`{ areas: areas }`),
     * the values will be updated but the class names stay the same.
     * You can also update classNames without updating the area values (`{ classNames: classNames }`).
     *
     * @public
     */

  }, {
    key: 'update',
    value: function update(data) {
      var _this8 = this;

      this.data = _extends({}, this.data, data);

      window.requestAnimationFrame(function () {
        _this8.clear();
        _this8.stack = _this8.updateStack();
        _this8.render();
      });
    }
  }]);

  return AreaGraph;
}();

////////////////////
// Move code BEFORE this line into a JS module and export it (`export default class AreaGraph`). Then import the AreaGraph component into the JS file where you include the BELOW code (`import AreaGraph from './modules/area-graph';`).
////////////////////


var Component = function () {
  function Component(element) {
    _classCallCheck(this, Component);

    this.element = element;

    this.init();
  }

  _createClass(Component, [{
    key: 'init',
    value: function init() {
      // Every array represents a series of values along the x-axis
      var areas = [
        // [3, 3, 4, 7, 8, 8, 7, 4, 3, 3],
        [1, 1, 2, 3, 3, 2, 1, 1],
        // [1, 1, 2, 5, 7, 7, 5, 2, 1, 1]
      ];

      var config = {
        container: this.element,
        data: {
          areaMeta: ['', { classNames: 'area--blue-light' }, { classNames: 'area--green-dark' }, { classNames: 'area--blue-light-dotted' }, { classNames: 'area--green-light' }, { classNames: 'area--blue-dark-dotted' }],
          areas: areas
        }
      };

      var areaGraph = new AreaGraph(config);

      // /**
      //  * For demonstration purposes only:
      //  *  `update()` can be used to update graph with new data.
      //  */
      //
      // var areas2 = [
      //   [0, 1.8061970119882962, 4.4546942419795623, 19.3914561984010384, 11.9553853048043845, 12.0257013425504596, 16.9393644042668157, 16.4790542331178078, 1.6586470760507369, 1.917017569236364],
      //   [0, 4.8061970119882962, 1.4546942419795623, 9.3914561984010384, 19.9553853048043845, 12.0257013425504596, 16.9393644042668157, 16.4790542331178078, 1.6586470760507369, 13.917017569236364],
      //   [20, 9.8061970119882962, 14.4546942419795623, 19.3914561984010384, 11.9553853048043845, 7.0257013425504596, 16.9393644042668157, 3.4790542331178078, 11.6586470760507369, 13.917017569236364]
      // ];
      //
      // setInterval(function () {
      //
      //   areaGraph.update({
      //     areas: areas2,
      //     areaMeta: [{ classNames: 'area--blue-light' }, '', { classNames: 'area--green-dark' }]
      //   });
      // }, 2000);
    }
  }]);

  return Component;
}();

var areaGraph = document.getElementById('area-graph');
if (areaGraph) {
  new Component(areaGraph);
}
