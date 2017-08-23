/*jslint browser: true*/
/*globals Event: false, describe: false, afterEach: false, beforeEach: false, after: false, it: false, canvasDatagrid: false, async: false, requestAnimationFrame: false*/
(function () {
    'use strict';
    var kcs = {
            up: 38,
            down: 40,
            left: 37,
            right: 39,
            enter: 13,
            tab: 9,
            space: 32,
            pgup: 33,
            pgdown: 34,
            a: 65,
            esc: 27
        },
        blocks = '██████████████████',
        c = {
            b: 'rgb(0, 0, 255)',
            y: 'rgb(255, 255, 0)',
            fu: 'rgb(255, 0, 255)',
            white: 'rgb(255, 255, 255)',
            black: 'rgb(0, 0, 0)'
        },
        markerColors = [
            '#a50026',
            '#d73027',
            '#f46d43',
            '#fdae61',
            '#fee090',
            '#e0f3f8',
            '#abd9e9',
            '#74add1',
            '#4575b4',
            '#313695'
        ],
        smallData = [
            {col1: 'foo', col2: 0, col3: 'a'},
            {col1: 'bar', col2: 1, col3: 'b'},
            {col1: 'baz', col2: 2, col3: 'c'}
        ];
    function itoa(n) {
        var ordA = 'a'.charCodeAt(0),
            ordZ = 'z'.charCodeAt(0),
            len = ordZ - ordA + 1,
            s = '';
        while (n >= 0) {
            s = String.fromCharCode(n % len + ordA) + s;
            n = Math.floor(n / len) - 1;
        }
        return s;
    }
    function makeData(r, c, dFn) {
        var y, x, d = [];
        for (y = 0; y < r; y += 1) {
            d[y] = {};
            for (x = 0; x < c; x += 1) {
                d[y][itoa(x)] = dFn ? dFn(y, x) : '';
            }
        }
        return d;
    }
    function cleanup(done) {
        //HACK: this allows for DOM events to cool off?
        setTimeout(done, 2);
        var m = document.getElementById('mocha');
        m.scrollTop = m.scrollHeight;
        if (this.currentTest && this.currentTest.grid) {
            this.currentTest.grid.disposeContextMenu();
        }
    }
    function marker(grid, x, y) {
        grid.markerCount = grid.markerCount || 0;
        grid.markerCount += 1;
        grid.addEventListener('afterdraw', function () {
            grid.ctx.fillStyle = markerColors[(grid.markerCount + (markerColors.length / 2)) % markerColors.length];
            grid.ctx.fillRect(0, y, grid.canvas.width, 1);
            grid.ctx.fillRect(x, 0, 1, grid.canvas.height);
            grid.ctx.fillStyle = markerColors[(grid.markerCount) %  markerColors.length];
            grid.ctx.fillRect(x - 1, y - 1, 3, 3);
        });
    }
    function assertPxColor(grid, x, y, expected, callback) {
        var d, match, e;
        function f() {
            d = grid.ctx.getImageData(x, y, 1, 1).data;
            d = 'rgb(' + [d['0'], d['1'], d['2']].join(', ') + ')';
            match = d === expected;
            if (expected !== undefined) {
                e = new Error('Expected color ' + expected + ' but got color ' + d);
                if (callback) {
                    marker(grid, x, y);
                    return callback(expected && !match ? e : undefined);
                }
            }
            requestAnimationFrame(grid.draw);
            return d;
        }
        if (!callback) {
            return f();
        }
        requestAnimationFrame(f);
    }
    function de(el, event, args) {
        var e = new Event(event);
        Object.keys(args).forEach(function (key) {
            e[key] = args[key];
        });
        el.dispatchEvent(e);
    }
    function keydown(el, keyCode, args) {
        args = args || {};
        args.keyCode = keyCode;
        de(el, 'keydown', args);
    }
    function bb(el) {
        return el.getBoundingClientRect();
    }
    function mouseup(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'mouseup', {clientX: x + p.left, clientY: y + p.top });
    }
    function mousemove(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'mousemove', {clientX: x + p.left, clientY: y + p.top });
    }
    function mousedown(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'mousedown', {clientX: x + p.left, clientY: y + p.top });
    }
    function contextmenu(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'contextmenu', {clientX: x + p.left, clientY: y + p.top });
    }
    function touchstart(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'touchstart', {touches: [{clientX: x + p.left, clientY: y + p.top }]});
    }
    function touchend(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'touchend', {touches: [{clientX: x + p.left, clientY: y + p.top }]});
    }
    function touchcancel(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'touchcancel', {touches: [{clientX: x + p.left, clientY: y + p.top }]});
    }
    function touchmove(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'touchmove', {touches: [{clientX: x + p.left, clientY: y + p.top }]});
    }
    function click(el, x, y, bbEl, ev) {
        var p = bb(bbEl || el);
        ev = ev || {};
        ev.clientX = x + p.left;
        ev.clientY = y + p.top;
        de(el, 'click', ev);
    }
    function dblclick(el, x, y, bbEl) {
        var p = bb(bbEl || el);
        de(el, 'dblclick', {clientX: x + p.left, clientY: y + p.top });
    }
    function g(args) {
        var grid,
            i = document.getElementById('grid'),
            a = document.createElement('div'),
            t = document.createElement('div'),
            d = document.createElement('div');
        a.className = 'test-container';
        d.className = 'grid-container';
        t.className = 'grid-test-title';
        t.innerHTML = args.test.title;
        function poll() {
            setTimeout(function () {
                if (args.test.state === 'failed') {
                    t.classList.add('grid-test-failed');
                    grid.draw();
                } else if (args.test.state === 'passed') {
                    t.classList.add('grid-test-passed');
                    grid.draw();
                } else {
                    poll();
                }
            }, 10);
        }
        poll();
        delete args.testTitle;
        a.appendChild(t);
        a.appendChild(d);
        // i.appendChild(a);
        i.insertBefore(a, i.firstChild);
        args = args || {};
        args.parentNode = d;
        grid = canvasDatagrid(args);
        args.test.grid = grid;
        return grid;
    }
    function assertIf(cond, msg) {
        var x;
        for (x = 2; x < arguments.length; x += 1) {
            msg = msg.replace(/%s|%n/, arguments[x]);
        }
        if (cond) { return new Error(msg); }
    }
    describe('canvas-datagrid', function () {
        after(function (done) {
            // git rid of lingering artifacts from the run
            mouseup(document.body, 1, 1);
            mouseup(document.body, 1, 1);
            click(document.body, 1, 1);
            done();
        });
        beforeEach(cleanup);
        afterEach(cleanup);
        describe('Integration Tests', function () {
            describe('Instantiation', function () {
                it('Should create an instance of datagrid', function (done) {
                    var grid = g({test: this.test});
                    assertIf(!grid, 'Expected a grid instance, instead got something false');
                    grid.style.backgroundColor = c.y;
                    assertPxColor(grid, 80, 32, c.y, done);
                });
                it('Should create, then completely annihilate the grid.', function (done) {
                    var grid = g({test: this.test});
                    grid.dispose();
                    done(assertIf(!grid.parentNode,
                        'Expected to see the grid gone, it is not.'));
                });
                it('Should create a grid and set data, data should be visible.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.style.activeCellBackgroundColor = c.white;
                    assertIf(grid.data.length !== 3,
                        'Expected to see data in the interface.');
                    assertPxColor(grid, 80, 32, c.white, done);
                });
            });
            describe('Styles', function () {
                it('Should set the active cell color to black.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.style.activeCellBackgroundColor = c.black;
                    assertPxColor(grid, 100, 32, c.black, done);
                });
                it('Each style setter should call draw 1 time.', function (done) {
                    var grid = g({
                            test: this.test,
                            data: smallData
                        }),
                        styleKeys = Object.keys(grid.style),
                        eventCount = 0;
                    grid.addEventListener('beforedraw', function () {
                        eventCount += 1;
                    });
                    async.eachSeries(styleKeys, function (s, cb) {
                        grid.style[s] = grid.style[s];
                        setTimeout(cb, 1);
                    }, function () {
                        done(assertIf(eventCount !== styleKeys.length,
                            'Wrong number of draw invocations on style setters.  Expected %n got %n.', styleKeys.length, eventCount));
                    });
                });
            });
            describe('Data interface', function () {
                it('Pass array of objects.', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = [
                        {'a': 0, 'b': 1, 'c': 2},
                        {'a': 4, 'b': 5, 'c': 6},
                        {'a': 7, 'b': 8, 'c': 9}
                    ];
                    done(assertIf(grid.data[2].c !== 9,
                        'Expected grid to be able to import and export this format'));
                });
                it('Pass array that contain other arrays of objects.', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = [
                        {'a': 0, 'b': 1, 'c': 2},
                        {'a': 4, 'b': [
                            {'a': 0, 'b': 1, 'c': 2},
                            {'a': 4, 'b': 5, 'c': 6},
                            {'a': 7, 'b': 8, 'c': 9}
                        ], 'c': 6},
                        {'a': 7, 'b': 8, 'c': 9}
                    ];
                    //TODO: this test cannot work until cell grids are fixed https://github.com/TonyGermaneri/canvas-datagrid/issues/35
                    // so this test success is false
                    done();
                });
                it('Pass array that contains an array of objects with mixed object/primitives as values.', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = [
                        {'a': 0, 'b': 1, 'c': 2},
                        {'a': 4, 'b': {'a': 0, 'b': 1, 'c': 2}, 'c': 6},
                        {'a': 7, 'b': 8, 'c': 9}
                    ];
                    //TODO: this test cannot work until cell grids are fixed https://github.com/TonyGermaneri/canvas-datagrid/issues/35
                    // so this test success is false
                    done();
                });
                it('Pass jagged data', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = [['a', 'b', 'c'], ['1', '2'], ['q']];
                    done(assertIf(grid.data[0][0] !== 'a',
                        'Expected grid to be able to import and export this format'));
                });
                it('Pass string to data', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = "blah";
                    done(assertIf(grid.data[0][0] !== 'blah',
                        'Expected grid to be able to import and export this format'));
                });
                it('Pass number to data', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = 4235234234;
                    done(assertIf(grid.data[0][0] !== 4235234234,
                        'Expected grid to be able to import and export this format'));
                });
                it('Pass boolean to data', function (done) {
                    var grid = g({
                        test: this.test
                    });
                    grid.data = false;
                    done(assertIf(grid.data[0][0] !== false,
                        'Expected grid to be able to import and export this format'));
                });
            });
            describe('Public interface', function () {
                it('Focus on the grid', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    done(assertIf(!grid.hasFocus, 'Expected the grid to have focus'));
                });
                it('Blur the grid', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.blur();
                    done(assertIf(grid.hasFocus, 'Expected the grid to not have focus'));
                });
                it('Insert column', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: '', e: ''}],
                        schema: [{name: 'd'}, {name: 'e'}]
                    });
                    grid.insertColumn({
                        name: 'f',
                        defaultValue: 'g'
                    }, 1);
                    done(assertIf(grid.schema[1].name !== 'f' || grid.data[0].f !== 'g',
                        'Expected to see a specific column here, it is not here.'));
                });
                it('Should throw an error if insertColumn is passed a bad index', function (done) {
                    var e, grid = g({
                        test: this.test,
                        data: [{d: '', e: ''}],
                        schema: [{name: 'd'}, {name: 'e'}]
                    });
                    try {
                        grid.insertColumn({
                            name: 'f',
                            defaultValue: 'g'
                        }, 5000);
                    } catch (er) {
                        e = er;
                    } finally {
                        done(assertIf(e === undefined,
                            'Expected insertColumn to throw an error.'));
                    }
                });
                it('Delete column', function (done) {
                    var grid = g({
                            test: this.test,
                            data: [{d: '', e: ''}]
                        }),
                        n = Object.keys(smallData[0])[0];
                    grid.deleteColumn(0);
                    done(assertIf(Object.keys(grid.data[0])[0] === n || grid.schema[0].name === n,
                        'Expected to see column 0 deleted, but it appears to still be there.'));
                });
                it('Add column', function (done) {
                    var l, grid = g({
                        test: this.test,
                        data: [{d: '', e: ''}],
                        schema: [{name: 'd'}, {name: 'e'}]
                    });
                    grid.addColumn({
                        name: 'f',
                        defaultValue: 'g'
                    });
                    l = grid.schema.length - 1;
                    done(assertIf(grid.schema[l].name !== 'f' || grid.data[0].f !== 'g',
                        'Expected to see a specific column here, it is not here.'));
                });
                it('Add row', function (done) {
                    var l, grid = g({
                        test: this.test,
                        data: [{d: '', e: ''}],
                        schema: [{name: 'd'}, {name: 'e', defaultValue: 10}]
                    });
                    grid.addRow({d: '1'});
                    l = grid.data.length - 1;
                    done(assertIf(grid.data[l].d !== '1' || grid.data[l].e !== 10,
                        'Expected to see a specific row here, it is not here.'));
                });
                it('Insert row', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: '1', e: '2'}, {d: '3', e: '4'}],
                        schema: [{name: 'd'}, {name: 'e', defaultValue: 10}]
                    });
                    grid.insertRow({d: '6'}, 1);
                    done(assertIf(grid.data[2].d !== '3' || grid.data[1].e !== 10,
                        'Expected to see a specific row here, it is not here.'));
                });
                it('Should throw an error if insertRow is passed a bad index', function (done) {
                    var e, grid = g({
                        test: this.test,
                        data: [{d: '', e: ''}],
                        schema: [{name: 'd'}, {name: 'e'}]
                    });
                    try {
                        grid.insertRow({d: '6'}, 5000);
                    } catch (er) {
                        e = er;
                    } finally {
                        done(assertIf(e === undefined,
                            'Expected insertRow to throw an error.'));
                    }
                });
                it('Delete row', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: '1'}, {d: '2'}]
                    });
                    grid.deleteRow(1);
                    done(assertIf(grid.data.length !== 1 || grid.data[0].d !== '1',
                        'Expected to see only 1 row, expected row 1 to contain a specific value.'));
                });
                it('Set row height', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.rowIndex === 0) {
                            e.ctx.fillStyle = c.y;
                        }
                    });
                    grid.setRowHeight(0, 60);
                    assertPxColor(grid, 40, 80, c.y, done);
                });
                it('Set column width', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.columnIndex === 0) {
                            e.ctx.fillStyle = c.y;
                        }
                    });
                    grid.setColumnWidth(0, 10);
                    setTimeout(function () {
                        assertPxColor(grid, 35, 78, c.y, done);
                    }, 1);
                });
                it('Reset row height', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.rowIndex !== 0) {
                            e.ctx.fillStyle = c.y;
                        }
                    });
                    grid.setRowHeight(0, 60);
                    grid.resetRowHeights();
                    assertPxColor(grid, 90, 80, c.y, done);
                });
                it('Reset column width', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.columnIndex === 1) {
                            e.ctx.fillStyle = c.y;
                        }
                    });
                    grid.setColumnWidth(0, 10);
                    grid.resetColumnWidths();
                    assertPxColor(grid, 340, 80, c.y, done);
                });
            });
            describe('Context menu', function () {
                it('Should produce a context menu', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            done(assertIf(!document.body.contains(e.items[0].title), 'Expected context menu to exist in the body and be visible.'));
                        }, 1);
                    });
                    contextmenu(grid.canvas, 60, 37);
                });
                it('Clicking Order by asc should order the selected column asc', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            e.items[2].contextItemContainer.dispatchEvent(new Event('click'));
                            done(assertIf(grid.data[0].col1 !== 'bar',
                                'Expected the content to be reordered asc.'));
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
                it('Create a child context menu and scroll up and down using mouseover events, then exit menu', function (done) {
                    var d = [], x, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    for (x = 0; x < 100; x += 1) {
                        d.push({
                            title: x
                        });
                    }
                    grid.addEventListener('contextmenu', function (e) {
                        e.items.push({
                            title: 'child menu',
                            items: d
                        });
                        setTimeout(function () {
                            e.items[4].contextItemContainer.dispatchEvent(new Event('mouseover'));
                            e.items[4].contextMenu.downArrow.dispatchEvent(new Event('mouseover'));
                            setTimeout(function () {
                                var err = assertIf(e.items[4].contextMenu.container.scrollTop === 0);
                                if (err) { return done(err); }
                                e.items[4].contextMenu.downArrow.dispatchEvent(new Event('mouseout'));
                                e.items[4].contextMenu.upArrow.dispatchEvent(new Event('mouseover'));
                                setTimeout(function () {
                                    e.items[4].contextMenu.upArrow.dispatchEvent(new Event('mouseout'));
                                    err = assertIf(e.items[4].contextMenu.container.scrollTop !== 0);
                                    if (err) { return done(err); }
                                    setTimeout(function () {
                                        e.items[4].contextItemContainer.dispatchEvent(new Event('mouseout'));
                                        done(assertIf(e.items[4].contextMenu !== undefined,
                                            'expected child context menu to be gone.'));
                                    }, 100);
                                }, 1500);
                            }, 1000);
                        }, 1);
                    });
                    contextmenu(grid.canvas, 60, 37);
                }).timeout(5000);
                it('Autocomplete should appear when a value is entered into the filter input', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            //HACK: get to filter input element in context menu
                            var i = e.items[0].title.children[1];
                            i.value = 'f';
                            i.dispatchEvent(new Event('keyup'));
                            done(assertIf(document.body.lastChild.childNodes.length === 1
                                    && document.body.lastChild.firstChild.innerHTML !== 'foo',
                                'Expected the autocomplete to be the most recent item added to body and expected it to only contain "foo"'));
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
                it('Autocomplete keys should key down and filter', function (done) {
                    var err,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            //HACK: get to filter input element in context menu
                            var i = e.items[0].title.children[1];
                            i.value = 'b';
                            i.dispatchEvent(new Event('keyup'));
                            ['down', 'enter'].forEach(function (kk) {
                                var ev = new Event('keydown');
                                ev.keyCode = kcs[kk];
                                i.dispatchEvent(ev);
                                if (kk === 'enter') {
                                    err = assertIf(grid.data[0].col1 !== 'baz', 'Expected key combination to filter for baz');
                                }
                            });
                            done(err);
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
                it('Autocomplete keys should key down, key up and filter', function (done) {
                    var err,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            //HACK: get to filter input element in context menu
                            var i = e.items[0].title.children[1];
                            i.value = 'b';
                            i.dispatchEvent(new Event('keyup'));
                            ['down', 'up', 'enter'].forEach(function (kk) {
                                var ev = new Event('keydown');
                                ev.keyCode = kcs[kk];
                                i.dispatchEvent(ev);
                                if (kk === 'enter') {
                                    err = assertIf(grid.data[0].col1 !== 'bar', 'Expected key combination to filter for bar');
                                }
                            });
                            done(err);
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
                it('Autocomplete keys should key tab', function (done) {
                    var err,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            //HACK: get to filter input element in context menu
                            var i = e.items[0].title.children[1];
                            i.value = 'f';
                            i.dispatchEvent(new Event('keyup'));
                            ['tab'].forEach(function (kk) {
                                var ev = new Event('keydown');
                                ev.keyCode = kcs[kk];
                                i.dispatchEvent(ev);
                                if (kk === 'tab') {
                                    err = assertIf(grid.data[0].col1 !== 'foo', 'Expected key combination to filter for bar');
                                }
                            });
                            done(err);
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
                it('Autocomplete keys should key esc', function (done) {
                    var err,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            //HACK: get to filter input element in context menu
                            var i = e.items[0].title.children[1];
                            i.value = 'f';
                            i.dispatchEvent(new Event('keyup'));
                            ['esc'].forEach(function (kk) {
                                var ev = new Event('keydown');
                                ev.keyCode = kcs[kk];
                                i.dispatchEvent(ev);
                                if (kk === 'esc') {
                                    err = assertIf(grid.data[0].col1 !== 'foo', 'Expected key combination to filter for bar');
                                }
                            });
                            done(err);
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
                it('Should store JSON view state data, then clear it once clear settings is clicked.', function (done) {
                    var n = 'a' + (new Date().getTime()),
                        k = 'canvasDataGrid-' + n,
                        grid = g({
                            test: this.test,
                            data: smallData,
                            name: n
                        });
                    grid.order('col1');
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            var err, i = localStorage.getItem(k);
                            e.items[1].contextItemContainer.dispatchEvent(new Event('click'));
                            err = assertIf(localStorage.getItem(k) === i, 'expected storage values to differ');
                            localStorage.removeItem(k);
                            done(err);
                        }, 1);
                    });
                    contextmenu(grid.canvas, 100, 37);
                });
            });
            describe('Scroll box with scrollPointerLock false', function () {
                it('Scroll horizontally via box drag', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500),
                        scrollPointerLock: false
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousedown(grid.canvas, 50, 113);
                        mousemove(document.body, 50, 113, grid.canvas);
                        setTimeout(function () {
                            // simulate very slow movement of humans
                            //marker(grid, 100, 113);
                            mousemove(document.body, 100, 113, grid.canvas);
                            mouseup(document.body, 100, 113, grid.canvas);
                            done(assertIf(grid.scrollLeft < 100,
                                'Expected the scroll bar to be further along.'));
                        }, 200);
                    }, 1);
                });
                it('Scroll horizontally right via margin click', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500),
                        scrollPointerLock: false
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 100, 113);
                        mousedown(grid.canvas, 100, 113);
                        setTimeout(function () {
                            mouseup(document.body, 100, 113, grid.canvas);
                            done(assertIf(grid.scrollLeft < 1,
                                 'Expected the scroll bar to be further along.'));
                        }, 2000);
                    }, 1);
                }).timeout(5000);
                it('Scroll horizontally left via margin click', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500),
                        scrollPointerLock: false
                    });
                    marker(grid, 60, 113);
                    grid.scrollLeft = grid.scrollWidth;
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 60, 113);
                        mousedown(grid.canvas, 60, 113);
                        setTimeout(function () {
                            mouseup(document.body, 60, 113, grid.canvas);
                            done(assertIf(grid.scrollLeft === grid.scrollWidth,
                                 'Expected the scroll bar to be further along.'));
                        }, 2000);
                    }, 1);
                }).timeout(5000);
                it('Scroll vertically via box drag', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500),
                        scrollPointerLock: false
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousedown(grid.canvas, 393, 35);
                        mousemove(document.body, 393, 35, grid.canvas);
                        setTimeout(function () {
                            // simulate very slow movement of humans
                            //marker(grid, 100, 113);
                            mousemove(document.body, 393, 100, grid.canvas);
                            mouseup(document.body, 393, 100, grid.canvas);
                            done(assertIf(grid.scrollTop < 100,
                                'Expected the scroll bar to be further along.'));
                        }, 200);
                    }, 1);
                });
                it('Scroll vertically down via margin click', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500),
                        scrollPointerLock: false
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 393, 100);
                        mousedown(grid.canvas, 393, 100);
                        setTimeout(function () {
                            mouseup(document.body, 393, 100, grid.canvas);
                            done(assertIf(grid.scrollTop < 1,
                                 'Expected the scroll bar to be further along.'));
                        }, 2000);
                    }, 1);
                }).timeout(5000);
                it('Scroll vertically up via margin click', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500),
                        scrollPointerLock: false
                    });
                    grid.scrollTop = grid.scrollHeight;
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 393, 75);
                        mousedown(grid.canvas, 393, 75);
                        setTimeout(function () {
                            mouseup(document.body, 393, 75, grid.canvas);
                            done(assertIf(grid.scrollTop === grid.scrollHeight,
                                 'Expected the scroll bar to be further along.'));
                        }, 2000);
                    }, 1);
                }).timeout(5000);
                it('Scroll horizontally via wheel', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: makeData(30, 500)
                    });
                    grid.focus();
                    ev = new Event('wheel');
                    ev.deltaX = 10;
                    ev.deltaY = 0;
                    grid.canvas.dispatchEvent(ev);
                    done(assertIf(grid.scrollLeft < 1,
                         'Expected the scroll bar to be further along.'));
                });
                it('Scroll vertically via wheel', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: makeData(30, 500)
                    });
                    grid.focus();
                    ev = new Event('wheel');
                    ev.deltaX = 0;
                    ev.deltaY = 10;
                    grid.canvas.dispatchEvent(ev);
                    done(assertIf(grid.scrollTop < 1,
                         'Expected the scroll bar to be further along.'));
                });
            });
            describe('Touch', function () {
                it('Touch and drag should scroll the grid vertically and horizontally', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    setTimeout(function () {
                        grid.focus();
                        touchstart(grid.canvas, 200, 37);
                        touchmove(document.body, 90, 37, grid.canvas);
                        setTimeout(function () {
                            // simulate very slow movement of humans
                            touchmove(document.body, 60, 66, grid.canvas);
                            touchend(document.body, 60, 66, grid.canvas);
                            done(assertIf(grid.scrollLeft === 0,
                                'Expected the grid to scroll some.'));
                        }, 200);
                    }, 1);
                });
                it('Touch and drag on the scroll bar should engage fast scrolling', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(30, 500)
                    });
                    setTimeout(function () {
                        grid.focus();
                        touchstart(grid.canvas, 50, 113);
                        touchmove(document.body, 50, 113, grid.canvas);
                        setTimeout(function () {
                            // simulate very slow movement of humans
                            touchmove(document.body, 100, 113, grid.canvas);
                            touchend(document.body, 100, 113, grid.canvas);
                            done(assertIf(grid.scrollLeft < 400,
                                'Expected the scroll bar to be further along.'));
                        }, 200);
                    }, 1);
                });
                it('Touch and hold should start selecting, moving should select until touchend', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    setTimeout(function () {
                        grid.focus();
                        touchstart(grid.canvas, 200, 37);
                        setTimeout(function () {
                            // simulate very slow movement of humans
                            grid.focus();
                            touchmove(document.body, 320, 90, grid.canvas);
                            touchend(document.body, 320, 90, grid.canvas);
                            setTimeout(function () {
                                done(assertIf(grid.selectedRows.length !== 3,
                                    'Expected all rows to become selected.'));
                            }, 1);
                        }, 1000);
                    }, 1);
                });
                it('Touch start should be cancel-able', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    setTimeout(function () {
                        grid.focus();
                        touchstart(grid.canvas, 200, 37);
                        setTimeout(function () {
                            // simulate very slow movement of humans
                            grid.focus();
                            touchcancel(document.body, 320, 90, grid.canvas);
                            setTimeout(function () {
                                done(assertIf(grid.selectedRows.length !== 1,
                                    'Expected 1 row to be selected.'));
                            }, 1);
                        }, 1000);
                    }, 1);
                });
            });
            describe('Editing', function () {
                it('Begin editing, end editing', function (done) {
                    var ev,
                        err,
                        editInput,
                        grid = g({
                            test: this.test,
                            data: [{d: ''}]
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    err = assertIf(editInput.tagName !== 'INPUT', 'Expected an input to have appeared');
                    if (err) { return done(err); }
                    ev = new Event('keydown');
                    ev.keyCode = kcs.esc;
                    grid.addEventListener('endedit', function () {
                        done();
                    });
                    editInput.dispatchEvent(ev);
                });
                it('Begin editing, enter a value, end editing', function (done) {
                    var ev,
                        editInput,
                        grid = g({
                            test: this.test,
                            data: [{d: ''}]
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    ev = new Event('keydown');
                    ev.keyCode = kcs.enter;
                    editInput.value = 'blah';
                    grid.addEventListener('endedit', function (e) {
                        done(assertIf(grid.data[0].d !== 'blah', 'Expected value to be in data'));
                    });
                    editInput.dispatchEvent(ev);
                });
                it('Begin editing, enter a value, end editing, abort before ending.', function (done) {
                    var ev,
                        editInput,
                        grid = g({
                            test: this.test,
                            data: [{d: ''}]
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    ev = new Event('keydown');
                    ev.keyCode = kcs.enter;
                    editInput.value = 'blah';
                    grid.addEventListener('beforeendedit', function (e) {
                        e.abort();
                        done(assertIf(grid.data[0].d === 'blah', 'Expected value to be in data'));
                    });
                    editInput.dispatchEvent(ev);
                });
                it('Begin editing a select with short definition.', function (done) {
                    var editInput,
                        grid = g({
                            test: this.test,
                            data: [{d: ''}],
                            schema: [{name: 'd', enum: ['a', 'b', 'c']}]
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    done(assertIf(editInput.childNodes.length === 3
                            && editInput.tagName !== 'SELECT', 'Expected an input to have appeared'));
                    grid.endEdit();
                });
                it('Begin editing a select with standard definition.', function (done) {
                    var editInput,
                        grid = g({
                            test: this.test,
                            data: [{d: ''}],
                            schema: [{name: 'd', enum: [['a', 'A'], ['b', 'B'], ['c', 'C']]}]
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    done(assertIf(editInput.childNodes[0].innerHTML === 'A'
                            && editInput.childNodes.length === 3
                            && editInput.tagName !== 'SELECT', 'Expected an input to have appeared'));
                    grid.endEdit();
                });
                it('Begin editing by double clicking a cell.', function (done) {
                    var editInput,
                        grid = g({
                            test: this.test,
                            data: [{d: ''}]
                        });
                    mousemove(grid.canvas, 45, 37);
                    mousedown(grid.canvas, 45, 37);
                    mouseup(grid.canvas, 45, 37);
                    mousedown(grid.canvas, 45, 37);
                    mouseup(grid.canvas, 45, 37);
                    dblclick(grid.canvas, 45, 37);
                    editInput = document.body.lastChild;
                    done(assertIf(editInput.tagName !== 'INPUT', 'Expected an input to have appeared'));
                    grid.endEdit();
                });
                it('Should copy a value onto the simulated clipboard.', function (done) {
                    var grid = g({
                            test: this.test,
                            data: [
                                {d: 'Text with, a comma 1', e: 'Text that has no comma in in 1'},
                                {d: 'Text with, a comma 2', e: 'Text that has no comma in in 2'}
                            ]
                        });
                    grid.selectAll();
                    grid.focus();
                    setTimeout(function () {
                        grid.copy({
                            clipboardData: {
                                setData: function (mime, data) {
                                    done(assertIf(mime !== 'text/plain'
                                        || data.indexOf('Text with') === -1, 'Expected data from the grid to be placed into the fake clipboard.'));
                                }
                            }
                        });
                    }, 1);
                });
                it('Begin editing, tab to next cell', function (done) {
                    var ev,
                        err,
                        editInput,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    ev = new Event('keydown');
                    ev.keyCode = kcs.tab;
                    editInput.dispatchEvent(ev);
                    grid.addEventListener('endedit', function (e) {
                        if (e.cell.columnIndex === 1) {
                            done();
                        }
                    });
                    grid.endEdit();
                });
                it('Begin editing, shift tab to very last cell', function (done) {
                    var ev,
                        err,
                        editInput,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.beginEditAt(0, 0);
                    editInput = document.body.lastChild;
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.tab;
                    grid.addEventListener('endedit', function (e) {
                        if (e.cell.columnIndex === 2 && e.cell.rowIndex === 2) {
                            done();
                        }
                    });
                    editInput.dispatchEvent(ev);
                    grid.endEdit();
                });
                it('Begin editing, tab to next row by hitting tab three times', function (done) {
                    var ev,
                        err,
                        editInput,
                        grid = g({
                            test: this.test,
                            data: smallData
                        });
                    grid.beginEditAt(0, 0);
                    grid.addEventListener('endedit', function (e) {
                        if (e.cell.columnIndex === 0 && e.cell.rowIndex === 0) {
                            done();
                        }
                    });
                    ev = new Event('keydown');
                    ev.keyCode = kcs.tab;
                    document.body.lastChild.dispatchEvent(ev);
                    document.body.lastChild.dispatchEvent(ev);
                    document.body.lastChild.dispatchEvent(ev);
                    grid.endEdit();
                });
            });
            describe('Key navigation', function () {
                it('Arrow down should move active cell down one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.down;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.rowIndex !== 1, 'Expected the active cell to move.'));
                });
                it('Arrow right should move active cell right one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.right;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.columnIndex !== 1, 'Expected the active cell to move.'));
                });
                it('Arrow right, then left should move active cell right one, then left one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.right;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.keyCode = kcs.left;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.columnIndex !== 0, 'Expected the active cell to move.'));
                });
                it('Arrow down, then up should move active cell down one, then up one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.down;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.keyCode = kcs.up;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.columnIndex !== 0, 'Expected the active cell to move.'));
                });
                it('Shift and Arrow down should add the selection down one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.space;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.down;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.selectedRows.length !== 2, 'Expected the active cell to move.'));
                });
                it('Shift and Arrow right should add the selection right one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.space;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.right;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.selectedRows.length !== 1 || grid.selections[0].col3 !== undefined, 'Expected the active cell to move.'));
                });
                it('Shift and Arrow left should add the selection to the left one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.space;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.right;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.left;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.selectedRows.length !== 1 || grid.selections[0].col3 !== undefined, 'Expected the active cell to move.'));
                });
                it('Shift and Arrow up should add the selection up one', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.space;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.down;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.shiftKey = true;
                    ev.keyCode = kcs.up;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.selectedRows.length !== 2 || grid.selections[0].col2 !== undefined, 'Expected the active cell to move.'));
                });
                it('Shift tab should behave like left arrow', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.right;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.keyCode = kcs.tab;
                    ev.shiftKey = true;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.columnIndex !== 0, 'Expected the active cell to move.'));
                });
                it('Tab should behave like right arrow', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.tab;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.columnIndex !== 1, 'Expected the active cell to move.'));
                });
                it('Tab should behave like right arrow', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.tab;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.columnIndex !== 1, 'Expected the active cell to move.'));
                });
                it('Keyup and keypress', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    grid.addEventListener('keyup', function () {
                        grid.addEventListener('keypress', function () {
                            done();
                        });
                        ev = new Event('keypress');
                        grid.controlInput.dispatchEvent(ev);
                    });
                    ev = new Event('keyup');
                    grid.controlInput.dispatchEvent(ev);
                });
                it('Page down should move down a page', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: makeData(50, 50)
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.pgdown;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.rowIndex !== 3, 'Expected the active cell to move.'));
                });
                it('Page up should move up a page', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: makeData(50, 50)
                    });
                    grid.focus();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.pgdown;
                    grid.controlInput.dispatchEvent(ev);
                    ev = new Event('keydown');
                    ev.keyCode = kcs.pgup;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.activeCell.rowIndex !== 0, 'Expected the active cell to move.'));
                });
                it('Space select just the active cell', function (done) {
                    var ev, grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.focus();
                    grid.selectAll();
                    ev = new Event('keydown');
                    ev.keyCode = kcs.space;
                    grid.controlInput.dispatchEvent(ev);
                    done(assertIf(grid.selectedRows.length !== 1, 'Expected to see one row selected.'));
                });
            });
            describe('Resize', function () {
                it('Resize a column.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        style: {
                            columnWidth: 50
                        }
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.columnIndex === 0) {
                            e.ctx.fillStyle = c.b;
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        marker(grid, 81, 10);
                        mousemove(grid.canvas, 81, 10);
                        mousedown(grid.canvas, 81, 10);
                        mousemove(grid.canvas, 120, 10, grid.canvas);
                        mousemove(document.body, 120, 10, grid.canvas);
                        mouseup(document.body, 120, 10, grid.canvas);
                        assertPxColor(grid, 100, 36, c.b, done);
                    }, 1);
                });
                it('Resize a column from a cell.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        allowColumnResizeFromCell: true,
                        style: {
                            columnWidth: 50
                        }
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.columnIndex === 0) {
                            e.ctx.fillStyle = c.b;
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 80, 36);
                        mousedown(grid.canvas, 80, 36);
                        mousemove(grid.canvas, 120, 36, grid.canvas);
                        mousemove(document.body, 120, 36, grid.canvas);
                        mouseup(document.body, 120, 36, grid.canvas);
                        assertPxColor(grid, 110, 36, c.b, done);
                    }, 1);
                });
                it('Resize a row.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        style: {
                            columnWidth: 50
                        }
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.columnIndex === -1 && e.cell.rowIndex === 0) {
                            e.ctx.fillStyle = c.b;
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 10, 49);
                        mousedown(grid.canvas, 10, 49);
                        mousemove(grid.canvas, 10, 100, grid.canvas);
                        mousemove(document.body, 10, 100, grid.canvas);
                        mouseup(document.body, 10, 100, grid.canvas);
                        assertPxColor(grid, 10, 90, c.b, done);
                    }, 1);
                });
                it('Resize a row from a cell.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        allowColumnResizeFromCell: true,
                        style: {
                            columnWidth: 50
                        }
                    });
                    grid.addEventListener('rendercell', function (e) {
                        if (e.cell.columnIndex === -1 && e.cell.rowIndex === 0) {
                            e.ctx.fillStyle = c.b;
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 40, 49);
                        mousedown(grid.canvas, 40, 49);
                        mousemove(grid.canvas, 40, 100, grid.canvas);
                        mousemove(document.body, 40, 100, grid.canvas);
                        mouseup(document.body, 40, 100, grid.canvas);
                        assertPxColor(grid, 10, 90, c.b, done);
                    }, 1);
                });
            });
            describe('Formatters', function () {
                it('Should format values using formating functions', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: ''}],
                        schema: [{name: 'd', type: 's'}],
                        formatters: {
                            s: function () {
                                return blocks;
                            }
                        }
                    });
                    assertPxColor(grid, 90, 32, c.black, done);
                });
            });
            describe('Sorters', function () {
                it('Should sort a string, should handle null and undefined', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{a: 'a'}, {a: 'b'}, {a: 'c'}, {a: 'd'}, {a: null}, {a: undefined}],
                        schema: [{name: 'a', type: 'string'}]
                    });
                    grid.order('a', 'desc');
                    done(assertIf(grid.data[0].a !== 'd', 'expected to see sort by string desc'));
                });
                it('Should sort numbers', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{a: 0}, {a: 1}, {a: 2}, {a: 3}, {a: 4}, {a: 5}],
                        schema: [{name: 'a', type: 'number'}]
                    });
                    grid.order('a', 'desc');
                    done(assertIf(grid.data[0].a !== 5, 'expected to see sort by number desc'));
                });
                it('Should sort date', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{a: 1503307131397}, {a: 1503307132397},
                            {a: 1503307133397}, {a: 1503307134397}, {a: 1503307135397}, {a: 1503307136397}],
                        schema: [{name: 'a', type: 'date'}]
                    });
                    grid.formatters.date =  function (e) {
                        return new Date(e.cell.value).toISOString();
                    };
                    grid.order('a', 'desc');
                    done(assertIf(grid.data[0].a !== 1503307136397, 'expected to see sort by date desc'));
                });
            });
            describe('Selections', function () {
                it('Should select all', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectAll();
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.y, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.length !== smallData.length,
                                    'Expected data interface `selectedRows` to contain all rows.  It does not.'));
                        });
                    });
                });
                it('Should select a row', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectRow(0);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.b, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.length !== 1,
                                    'Expected data interface `selectedRows` 1 row.  It does not.'));
                        });
                    });
                });
                it('Should select a row, then add to the selection with control', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectRow(0);
                    grid.selectRow(2, true);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.y, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.filter(function (row) {
                                return row[0] !== null;
                            }).length !== 2, 'Expected data interface `selectedRows` 2 rows.  It does not.'));
                        });
                    });
                });
                it('Should select a row, then add to the selection with control, then remove it with control', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectRow(0);
                    grid.selectRow(2, true);
                    grid.selectRow(0, true);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 340, 30, c.b, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.y, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.filter(function (row) {
                                return row !== null;
                            }).length !== 1, 'Expected data interface `selectedRows` 1 row.  It does not.'));
                        });
                    });
                });
                it('Should select a range of rows by holding shift', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectRow(0);
                    grid.selectRow(2, null, true);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.y, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.filter(function (row) {
                                return row !== null;
                            }).length !== 3, 'Expected data interface `selectedRows` 1 row.  It does not.'));
                        });
                    });
                });
                it('Should select a column', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectColumn(0);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.b, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.length !== smallData.length,
                                    'Expected data interface `selectedRows` to contain all rows.  It does not.'));
                        });
                    });
                });
                it('Should select a column, then add a column to the selection.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectColumn(0);
                    grid.selectColumn(1, true);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.y, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.length !== smallData.length,
                                    'Expected data interface `selectedRows` to contain all rows.  It does not.'));
                        });
                    });
                });
                it('Should select a range of columns via shift.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        style: {
                            columnWidth: 50
                        }
                    });
                    grid.selectColumn(0);
                    grid.selectColumn(2, false, true);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 70, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 170, 90, c.y, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.length !== smallData.length,
                                    'Expected data interface `selectedRows` to contain all rows.  It does not.'));
                        });
                    });
                });
                it('Should select a column, then add to the column selection and immediately remove it', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.selectColumn(0);
                    grid.selectColumn(1, true);
                    grid.selectColumn(1, true);
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.b;
                    assertPxColor(grid, 90, 30, c.y, function (err) {
                        if (err) { return done(err); }
                        assertPxColor(grid, 360, 90, c.b, function (err) {
                            if (err) { return done(err); }
                            done(assertIf(grid.selectedRows.length !== smallData.length,
                                    'Expected data interface `selectedRows` to contain all rows.  It does not.'));
                        });
                    });
                });
                it('Should select an area when click and drag occurs', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.fu;
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 67, 30);
                        mousedown(grid.canvas, 67, 30);
                        mousemove(grid.canvas, 320, 65, grid.canvas);
                        mousemove(document.body, 320, 65, grid.canvas);
                        mouseup(document.body, 320, 65, grid.canvas);
                        mouseup(grid.canvas, 320, 65, grid.canvas);
                        click(grid.canvas, 320, 65);
                        assertPxColor(grid, 67, 30, c.y, function (err) {
                            if (err) { return done(err); }
                            assertPxColor(grid, 350, 65, c.y, function (err) {
                                if (err) { return done(err); }
                                assertPxColor(grid, 360, 80, c.fu, function (err) {
                                    if (err) { return done(err); }
                                    done(assertIf(grid.selectedRows.length !== smallData.length - 1,
                                            'Expected data interface `selectedRows` to contain all but one rows.  It does not.'));
                                });
                            });
                        });
                    }, 1);
                });
                it('Should remove a cell from selection when holding control and clicking a selected cell', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.style.activeCellSelectedBackgroundColor = c.y;
                    grid.style.cellHoverBackgroundColor = c.b;
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.style.cellBackgroundColor = c.fu;
                    setTimeout(function () {
                        var p = bb(grid.canvas);
                        grid.focus();
                        mousemove(grid.canvas, 67, 30);
                        mousedown(grid.canvas, 67, 30);
                        mousemove(grid.canvas, 320, 65, grid.canvas);
                        mousemove(document.body, 320, 65, grid.canvas);
                        mouseup(document.body, 320, 65, grid.canvas);
                        mouseup(grid.canvas, 320, 65, grid.canvas);
                        click(grid.canvas, 320, 65);
                        // ctrl click
                        de(grid.canvas, 'mousemove', {clientX: 320 + p.left, clientY: 65 + p.top, controlKey: true });
                        de(grid.canvas, 'mousedown', {clientX: 320 + p.left, clientY: 65 + p.top, controlKey: true });
                        de(document.body, 'mouseup', {clientX: 320 + p.left, clientY: 65 + p.top, controlKey: true });
                        de(grid.canvas, 'mouseup', {clientX: 320 + p.left, clientY: 65 + p.top, controlKey: true });
                        assertPxColor(grid, 67, 30, c.y, function (err) {
                            if (err) { return done(err); }
                            assertPxColor(grid, 350, 65, c.b, function (err) {
                                if (err) { return done(err); }
                                assertPxColor(grid, 360, 80, c.fu, function (err) {
                                    if (err) { return done(err); }
                                    done(assertIf(grid.selectedRows.length !== smallData.length - 1
                                        && grid.selectedRows[1].col2 === undefined,
                                            'Expected data interface `selectedRows` to contain row 1 col1 and col2, row 2 col 1.  It does not.'));
                                });
                            });
                        });
                    }, 1);
                });
            });
            describe('Filters', function () {
                it('Should filter for given value', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: 'abcd'}, {d: 'edfg'}]
                    });
                    grid.setFilter('d', 'edfg');
                    done(assertIf(grid.data.length === 0 && grid.data[0].d === 'edfg',
                            'Expected filter to remove all but 1 row.'));
                });
                it('Should remove all filters', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: 'abcd', e: 'qwert'}, {d: 'edfg', e: 'asdfg'}]
                    });
                    grid.setFilter('d', 'edfg');
                    grid.setFilter('e', 'asdfg');
                    grid.setFilter();
                    done(assertIf(grid.data.length !== 2, 'Expected to see all the records return.'));
                });
                it('Should remove a specific filter by passing empty string', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: 'abcd', e: 'qwert'}, {d: 'edfg', e: 'asdfg'}]
                    });
                    grid.setFilter('d', 'edfg');
                    grid.setFilter('e', 'asdfg');
                    grid.setFilter('e', '');
                    done(assertIf(grid.data.length !== 1, 'Expected to see 1 of the records.'));
                });
                it('Should remove a specific filter by passing undefined', function (done) {
                    var grid = g({
                        test: this.test,
                        data: [{d: 'abcd', e: 'qwert'}, {d: 'edfg', e: 'asdfg'}]
                    });
                    grid.setFilter('d', 'edfg');
                    grid.setFilter('e', 'asdfg');
                    grid.setFilter('e');
                    done(assertIf(grid.data.length !== 1, 'Expected to see 1 of the records.'));
                });
            });
            describe('Attributes', function () {
                it('Should store JSON view state data when a name is passed and view state is altered.', function (done) {
                    var n = 'a' + (new Date().getTime()),
                        k = 'canvasDataGrid-' + n,
                        grid = g({
                            test: this.test,
                            data: smallData,
                            name: n
                        });
                    grid.order('col1');
                    assertIf(!JSON.parse(localStorage.getItem(k)),
                        'Expected storage item %s.', n);
                    localStorage.removeItem(k);
                    done();
                });
                it('Should produce clickable tree arrows and allow for opening trees when clicked, should invoke expandtree event handler.  Handler event should contain a new grid.', function (done) {
                    var grid = g({
                        test: this.test,
                        tree: true,
                        data: smallData
                    });
                    grid.addEventListener('expandtree', function (e) {
                        assertIf(e.treeGrid === undefined, 'Expected a grid here.');
                        e.treeGrid.style.cornerCellBackgroundColor = c.y;
                        assertPxColor(grid, 10, 34, c.fu, function () {
                            assertPxColor(grid, 60, 60, c.y, done);
                        });
                    });
                    grid.style.treeArrowColor = c.fu;
                    click(grid.canvas, 7, 37);
                });
                it('Should be able to close tree grids.', function (done) {
                    var grid = g({
                        test: this.test,
                        tree: true,
                        data: smallData
                    });
                    grid.addEventListener('expandtree', function (e) {
                        var err = assertIf(e.treeGrid === undefined, 'Expected a grid here.');
                        if (err) { return done(err); }
                        e.treeGrid.style.cornerCellBackgroundColor = c.y;
                    });
                    grid.style.treeArrowColor = c.fu;
                    grid.style.cellBackgroundColor = c.b;
                    click(grid.canvas, 7, 37);
                    click(grid.canvas, 7, 37);
                    setTimeout(function () {
                        assertPxColor(grid, 130, 60, c.b, done);
                    }, 2);
                });
                it('Should display a new row', function (done) {
                    var grid = g({
                        test: this.test,
                        showNewRow: true,
                        data: [{a: 'a'}]
                    });
                    grid.style.cellBackgroundColor = c.y;
                    assertIf(grid.data.length !== 1, 'Expected there to be exactly 1 row.');
                    assertPxColor(grid, 40, 60, c.y, done);
                });
                //TODO: treeHorizontalScroll
                it('Should NOT store JSON view state data when saveAppearance is false.', function (done) {
                    var n = 'a' + (new Date().getTime()),
                        k = 'canvasDataGrid-' + n,
                        grid = g({
                            test: this.test,
                            data: smallData,
                            name: n,
                            saveAppearance: false
                        });
                    grid.order('col1');
                    assertIf(JSON.parse(localStorage.getItem(k)),
                        'Expected storage item %s.', n);
                    localStorage.removeItem(k);
                    done();
                });
                it('Selection should follow active cell with selectionFollowsActiveCell true', function (done) {
                    var grid = g({
                        test: this.test,
                        selectionFollowsActiveCell: true,
                        data: [{a: 'a'}, {a: 'b'}]
                    });
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.focus();
                    // select cell 0:0
                    click(grid.canvas, 60, 37);
                    keydown(grid.controlInput, 40);
                    done(assertIf(grid.selectedRows[1].a !== 'b', 'Expected selection to follow active cell'));
                });
                it('Selection should NOT follow active cell with selectionFollowsActiveCell false', function (done) {
                    var grid = g({
                        test: this.test,
                        selectionFollowsActiveCell: false,
                        data: [{a: 'a'}, {a: 'b'}]
                    });
                    grid.style.cellSelectedBackgroundColor = c.y;
                    grid.focus();
                    // select cell 0:0
                    click(grid.canvas, 60, 37);
                    keydown(grid.controlInput, 40);
                    done(assertIf(grid.selectedRows.length === 0, 'Expected selection to not follow active cell'));
                });
                it('Should use a textarea to edit when multiLine is true', function (done) {
                    var grid = g({
                        test: this.test,
                        multiLine: true,
                        data: smallData
                    });
                    grid.beginEditAt(0, 0);
                    done(assertIf(grid.input.tagName !== 'TEXTAREA', 'Expected a textarea here'));
                    grid.endEdit();
                });
                it('Should use an input to edit when multiLine is false', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    grid.beginEditAt(0, 0);
                    done(assertIf(grid.input.tagName !== 'INPUT', 'Expected an input here'));
                    grid.endEdit();
                });
                it('Should not be editable when editable is false', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        editable: false
                    });
                    click(grid.canvas, 60, 37);
                    keydown(grid.controlInput, 13);
                    done(assertIf(grid.input !== undefined, 'Expected no input when UI enters edit mode.'));
                });
                it('Should be editable when editable is true', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData
                    });
                    click(grid.canvas, 60, 37);
                    keydown(grid.controlInput, 13);
                    done(assertIf(grid.input === undefined, 'Expected an input when UI enters edit mode.'));
                    grid.endEdit();
                });
                it('Should allow column reordering when allowColumnReordering is true', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(3, 3, function (y, x) { return x + ':' + y; }),
                        style: {
                            columnWidth: 50
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 67, 10);
                        mousedown(grid.canvas, 67, 10);
                        mousemove(grid.canvas, 200, 10, grid.canvas);
                        mousemove(document.body, 200, 10, grid.canvas);
                        mouseup(document.body, 200, 10, grid.canvas);
                        grid.draw();
                        grid.addEventListener('click', function (e) {
                            done(assertIf(e.cell.value !== '1:0', 'Expected to see the value from column 2 here, instead saw %n.', e.cell.value));
                        });
                        // lib intentionally ignoring next click - required to make the ux work as desired
                        click(grid.canvas, 60, 37);
                        click(grid.canvas, 60, 37);
                    }, 1);
                });
                it('Should draw column reorder markers when allowColumnReordering is true and reordering', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        style: {
                            columnWidth: 50,
                            reorderMarkerBackgroundColor: c.y,
                            reorderMarkerBorderWidth: 4,
                            reorderMarkerBorderColor: c.fu,
                            reorderMarkerIndexBorderColor: c.b,
                            reorderMarkerIndexBorderWidth: 4
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 67, 10);
                        mousedown(grid.canvas, 67, 10);
                        mousemove(grid.canvas, 180, 10, grid.canvas);
                        mousemove(document.body, 180, 10, grid.canvas);
                        assertPxColor(grid, 160, 10, c.y, function (err) {
                            if (err) { return done(err); }
                            assertPxColor(grid, 145, 90, c.fu, function (err) {
                                if (err) { return done(err); }
                                assertPxColor(grid, 132, 50, c.b, done);
                            });
                        });
                        grid.draw();
                    }, 10);
                });
                it('Should allow row reordering when allowRowReordering is true', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        allowRowReordering: true,
                        style: {
                            columnWidth: 50
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 10, 37);
                        mousedown(grid.canvas, 10, 37);
                        mousemove(grid.canvas, 10, 75, grid.canvas);
                        mousemove(document.body, 10, 75, grid.canvas);
                        mouseup(document.body, 10, 75, grid.canvas);
                        grid.draw();
                        grid.addEventListener('click', function (e) {
                            done(assertIf(e.cell.value !== 'bar', 'Expected to see the value from row 2 here.'));
                        });
                        // lib intentionally ignoring next click - required to make the ux work as desired
                        click(grid.canvas, 60, 37);
                        click(grid.canvas, 60, 37);
                    }, 1);
                });
                it('Should draw row reorder markers when allowRowReordering is true and reordering', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        allowRowReordering: true,
                        style: {
                            columnWidth: 50,
                            reorderMarkerBackgroundColor: c.y,
                            reorderMarkerBorderWidth: 4,
                            reorderMarkerBorderColor: c.fu,
                            reorderMarkerIndexBorderColor: c.b,
                            reorderMarkerIndexBorderWidth: 4
                        }
                    });
                    setTimeout(function () {
                        grid.focus();
                        mousemove(grid.canvas, 10, 37);
                        mousedown(grid.canvas, 10, 37);
                        mousemove(grid.canvas, 10, 75, grid.canvas);
                        mousemove(document.body, 10, 75, grid.canvas);
                        assertPxColor(grid, 10, 74, c.b, function (err) {
                            if (err) { return done(err); }
                            assertPxColor(grid, 20, 63, c.fu, function (err) {
                                if (err) { return done(err); }
                                assertPxColor(grid, 30, 69, c.y, done);
                            });
                        });
                        grid.draw();
                    }, 10);
                });
                it('The context menu filter should not show up when showFilter is false', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        showFilter: false
                    });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            done(assertIf(e.items.length !== 3,
                                'Expected to only see two items in the context menu at this point.'));
                        }, 1);
                    });
                    contextmenu(grid.canvas, 60, 37);
                });
                it('The context menu filter should show up when showFilter is true', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        showFilter: true
                    });
                    grid.addEventListener('contextmenu', function (e) {
                        setTimeout(function () {
                            done(assertIf(e.items.length !== 4,
                                'Expected to only see two items in the context menu at this point.'));
                        }, 1);
                    });
                    contextmenu(grid.canvas, 60, 37);
                });
                it('Clicking the corner cell will return dataset to original sort order and filter settings.', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(10, 10, function (x) { return x; }),
                        columnHeaderClickBehavior: 'sort'
                    });
                    marker(grid, 60, 12);
                    mousemove(grid.canvas, 60, 12);
                    click(grid.canvas, 60, 12);
                    setTimeout(function () {
                        marker(grid, 12, 12);
                        mousemove(grid.canvas, 12, 12);
                        click(grid.canvas, 12, 12);
                        done(assertIf(grid.data[0].a !== 0, 'Expected data to be sorted.'));
                    }, 1);
                });
                it('Clicking a header cell with columnHeaderClickBehavior set to sort should sort the column asc', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        columnHeaderClickBehavior: 'sort'
                    });
                    marker(grid, 40, 12);
                    mousemove(grid.canvas, 40, 12);
                    click(grid.canvas, 40, 12);
                    done(assertIf(grid.data[0].col1 !== 'bar', 'Expected data to be sorted.'));
                });
                it('Clicking a header cell with columnHeaderClickBehavior set to select should select the column', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        columnHeaderClickBehavior: 'select'
                    });
                    marker(grid, 40, 12);
                    mousemove(grid.canvas, 40, 12);
                    click(grid.canvas, 40, 12);
                    done(assertIf(grid.selectedRows.length !== 3
                        || grid.selectedCells[0].col2 !== undefined, 'Expected every row to be selected.'));
                });
                it('Clicking a header cell with columnHeaderClickBehavior set to select then clicking another with ctrl held should add to the selection', function (done) {
                    var grid = g({
                        test: this.test,
                        data: smallData,
                        columnHeaderClickBehavior: 'select',
                        style: {
                            columnWidth: 50
                        }
                    });
                    marker(grid, 40, 12);
                    mousemove(grid.canvas, 40, 12);
                    click(grid.canvas, 40, 12);
                    mousemove(grid.canvas, 175, 12);
                    click(grid.canvas, 175, 12, null, {controlKey: true});
                    done(assertIf(grid.selectedRows.length !== 3
                        || grid.selectedCells[0].col2 !== undefined
                        || grid.selectedCells[0].col3 !== 'a', 'Expected every row to be selected and column 2 to not be selected.'));
                });
                it('Clicking a header cell with columnHeaderClickBehavior set to select then clicking another with shift held should add a range to the selection', function (done) {
                    var grid = g({
                        test: this.test,
                        data: makeData(3, 3, function (y, x) { return x + ':' + y; }),
                        columnHeaderClickBehavior: 'select',
                        style: {
                            columnWidth: 50
                        }
                    });
                    marker(grid, 40, 12);
                    mousemove(grid.canvas, 40, 12);
                    click(grid.canvas, 40, 12);
                    mousemove(grid.canvas, 175, 12);
                    click(grid.canvas, 175, 12, null, {shiftKey: true});
                    done(assertIf(grid.selectedRows.length !== 3
                        || grid.selectedCells[0].c !== '2:0'
                        || grid.selectedCells[0].b !== '1:0', 'Expected everything to be selected.'));
                });
            });
        });
    });
}());
