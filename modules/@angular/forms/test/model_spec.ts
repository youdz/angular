import {ddescribe, describe, it, iit, xit, expect, beforeEach, afterEach, inject,} from '@angular/core/testing/testing_internal';
import {fakeAsync, flushMicrotasks, Log, tick} from '@angular/core/testing';
import {AsyncTestCompleter} from '@angular/core/testing/testing_internal';
import {FormGroup, FormControl, FormArray, Validators} from '@angular/forms';
import {IS_DART, isPresent} from '../src/facade/lang';
import {PromiseWrapper} from '../src/facade/promise';
import {TimerWrapper, ObservableWrapper, EventEmitter} from '../src/facade/async';

export function main() {
  function asyncValidator(expected: any /** TODO #9100 */, timeouts = /*@ts2dart_const*/ {}) {
    return (c: any /** TODO #9100 */) => {
      var completer = PromiseWrapper.completer();
      var t = isPresent((timeouts as any /** TODO #9100 */)[c.value]) ?
          (timeouts as any /** TODO #9100 */)[c.value] :
          0;
      var res = c.value != expected ? {'async': true} : null;

      if (t == 0) {
        completer.resolve(res);
      } else {
        TimerWrapper.setTimeout(() => { completer.resolve(res); }, t);
      }

      return completer.promise;
    };
  }

  function asyncValidatorReturningObservable(c: any /** TODO #9100 */) {
    var e = new EventEmitter();
    PromiseWrapper.scheduleMicrotask(() => ObservableWrapper.callEmit(e, {'async': true}));
    return e;
  }

  function otherAsyncValidator() { return PromiseWrapper.resolve({'other': true}); }

  describe('Form Model', () => {
    describe('FormControl', () => {
      it('should default the value to null', () => {
        var c = new FormControl();
        expect(c.value).toBe(null);
      });

      describe('validator', () => {
        it('should run validator with the initial value', () => {
          var c = new FormControl('value', Validators.required);
          expect(c.valid).toEqual(true);
        });

        it('should rerun the validator when the value changes', () => {
          var c = new FormControl('value', Validators.required);
          c.updateValue(null);
          expect(c.valid).toEqual(false);
        });

        it('should support arrays of validator functions if passed', () => {
          const c = new FormControl('value', [Validators.required, Validators.minLength(3)]);
          c.updateValue('a');
          expect(c.valid).toEqual(false);

          c.updateValue('aaa');
          expect(c.valid).toEqual(true);
        });

        it('should return errors', () => {
          var c = new FormControl(null, Validators.required);
          expect(c.errors).toEqual({'required': true});
        });

        it('should set single validator', () => {
          var c = new FormControl(null);
          expect(c.valid).toEqual(true);

          c.setValidators(Validators.required);

          c.updateValue(null);
          expect(c.valid).toEqual(false);

          c.updateValue('abc');
          expect(c.valid).toEqual(true);
        });

        it('should set multiple validators from array', () => {
          var c = new FormControl('');
          expect(c.valid).toEqual(true);

          c.setValidators([Validators.minLength(5), Validators.required]);

          c.updateValue('');
          expect(c.valid).toEqual(false);

          c.updateValue('abc');
          expect(c.valid).toEqual(false);

          c.updateValue('abcde');
          expect(c.valid).toEqual(true);
        });

        it('should clear validators', () => {
          var c = new FormControl('', Validators.required);
          expect(c.valid).toEqual(false);

          c.clearValidators();
          expect(c.validator).toEqual(null);

          c.updateValue('');
          expect(c.valid).toEqual(true);
        });

        it('should add after clearing', () => {
          var c = new FormControl('', Validators.required);
          expect(c.valid).toEqual(false);

          c.clearValidators();
          expect(c.validator).toEqual(null);

          c.setValidators([Validators.required]);
          expect(c.validator).not.toBe(null);
        });
      });

      describe('asyncValidator', () => {
        it('should run validator with the initial value', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));
             tick();

             expect(c.valid).toEqual(false);
             expect(c.errors).toEqual({'async': true});
           }));

        it('should support validators returning observables', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidatorReturningObservable);
             tick();

             expect(c.valid).toEqual(false);
             expect(c.errors).toEqual({'async': true});
           }));

        it('should rerun the validator when the value changes', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));

             c.updateValue('expected');
             tick();

             expect(c.valid).toEqual(true);
           }));

        it('should run the async validator only when the sync validator passes', fakeAsync(() => {
             var c = new FormControl('', Validators.required, asyncValidator('expected'));
             tick();

             expect(c.errors).toEqual({'required': true});

             c.updateValue('some value');
             tick();

             expect(c.errors).toEqual({'async': true});
           }));

        it('should mark the control as pending while running the async validation',
           fakeAsync(() => {
             var c = new FormControl('', null, asyncValidator('expected'));

             expect(c.pending).toEqual(true);

             tick();

             expect(c.pending).toEqual(false);
           }));

        it('should only use the latest async validation run', fakeAsync(() => {
             var c = new FormControl(
                 '', null, asyncValidator('expected', {'long': 200, 'expected': 100}));

             c.updateValue('long');
             c.updateValue('expected');

             tick(300);

             expect(c.valid).toEqual(true);
           }));

        it('should support arrays of async validator functions if passed', fakeAsync(() => {
             const c =
                 new FormControl('value', null, [asyncValidator('expected'), otherAsyncValidator]);
             tick();

             expect(c.errors).toEqual({'async': true, 'other': true});
           }));

        it('should add single async validator', fakeAsync(() => {
             var c = new FormControl('value', null);

             c.setAsyncValidators(asyncValidator('expected'));
             expect(c.asyncValidator).not.toEqual(null);

             c.updateValue('expected');
             tick();

             expect(c.valid).toEqual(true);
           }));

        it('should add async validator from array', fakeAsync(() => {
             var c = new FormControl('value', null);

             c.setAsyncValidators([asyncValidator('expected')]);
             expect(c.asyncValidator).not.toEqual(null);

             c.updateValue('expected');
             tick();

             expect(c.valid).toEqual(true);
           }));

        it('should clear async validators', fakeAsync(() => {
             var c = new FormControl('value', [asyncValidator('expected'), otherAsyncValidator]);

             c.clearValidators();

             expect(c.asyncValidator).toEqual(null);
           }));
      });

      describe('dirty', () => {
        it('should be false after creating a control', () => {
          var c = new FormControl('value');
          expect(c.dirty).toEqual(false);
        });

        it('should be true after changing the value of the control', () => {
          var c = new FormControl('value');
          c.markAsDirty();
          expect(c.dirty).toEqual(true);
        });
      });

      describe('updateValue', () => {
        var g: any /** TODO #9100 */, c: any /** TODO #9100 */;
        beforeEach(() => {
          c = new FormControl('oldValue');
          g = new FormGroup({'one': c});
        });

        it('should update the value of the control', () => {
          c.updateValue('newValue');
          expect(c.value).toEqual('newValue');
        });

        it('should invoke ngOnChanges if it is present', () => {
          var ngOnChanges: any /** TODO #9100 */;
          c.registerOnChange((v: any /** TODO #9100 */) => ngOnChanges = ['invoked', v]);

          c.updateValue('newValue');

          expect(ngOnChanges).toEqual(['invoked', 'newValue']);
        });

        it('should not invoke on change when explicitly specified', () => {
          var onChange: any /** TODO #9100 */ = null;
          c.registerOnChange((v: any /** TODO #9100 */) => onChange = ['invoked', v]);

          c.updateValue('newValue', {emitModelToViewChange: false});

          expect(onChange).toBeNull();
        });

        it('should update the parent', () => {
          c.updateValue('newValue');
          expect(g.value).toEqual({'one': 'newValue'});
        });

        it('should not update the parent when explicitly specified', () => {
          c.updateValue('newValue', {onlySelf: true});
          expect(g.value).toEqual({'one': 'oldValue'});
        });

        it('should fire an event', fakeAsync(() => {
             ObservableWrapper.subscribe(
                 c.valueChanges, (value) => { expect(value).toEqual('newValue'); });

             c.updateValue('newValue');
             tick();
           }));

        it('should not fire an event when explicitly specified', fakeAsync(() => {
             ObservableWrapper.subscribe(c.valueChanges, (value) => { throw 'Should not happen'; });

             c.updateValue('newValue', {emitEvent: false});

             tick();
           }));
      });

      describe('valueChanges & statusChanges', () => {
        var c: any /** TODO #9100 */;

        beforeEach(() => { c = new FormControl('old', Validators.required); });

        it('should fire an event after the value has been updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             ObservableWrapper.subscribe(c.valueChanges, (value) => {
               expect(c.value).toEqual('new');
               expect(value).toEqual('new');
               async.done();
             });
             c.updateValue('new');
           }));

        it('should fire an event after the status has been updated to invalid', fakeAsync(() => {
             ObservableWrapper.subscribe(c.statusChanges, (status) => {
               expect(c.status).toEqual('INVALID');
               expect(status).toEqual('INVALID');
             });

             c.updateValue('');
             tick();
           }));

        it('should fire an event after the status has been updated to pending', fakeAsync(() => {
             var c = new FormControl('old', Validators.required, asyncValidator('expected'));

             var log: any[] /** TODO #9100 */ = [];
             ObservableWrapper.subscribe(c.valueChanges, (value) => log.push(`value: '${value}'`));
             ObservableWrapper.subscribe(
                 c.statusChanges, (status) => log.push(`status: '${status}'`));

             c.updateValue('');
             tick();

             c.updateValue('nonEmpty');
             tick();

             c.updateValue('expected');
             tick();

             expect(log).toEqual([
               '' +
                   'value: \'\'',
               'status: \'INVALID\'',
               'value: \'nonEmpty\'',
               'status: \'PENDING\'',
               'status: \'INVALID\'',
               'value: \'expected\'',
               'status: \'PENDING\'',
               'status: \'VALID\'',
             ]);
           }));

        // TODO: remove the if statement after making observable delivery sync
        if (!IS_DART) {
          it('should update set errors and status before emitting an event',
             inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
               c.valueChanges.subscribe((value: any /** TODO #9100 */) => {
                 expect(c.valid).toEqual(false);
                 expect(c.errors).toEqual({'required': true});
                 async.done();
               });
               c.updateValue('');
             }));
        }

        it('should return a cold observable',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             c.updateValue('will be ignored');
             ObservableWrapper.subscribe(c.valueChanges, (value) => {
               expect(value).toEqual('new');
               async.done();
             });
             c.updateValue('new');
           }));
      });

      describe('setErrors', () => {
        it('should set errors on a control', () => {
          var c = new FormControl('someValue');

          c.setErrors({'someError': true});

          expect(c.valid).toEqual(false);
          expect(c.errors).toEqual({'someError': true});
        });

        it('should reset the errors and validity when the value changes', () => {
          var c = new FormControl('someValue', Validators.required);

          c.setErrors({'someError': true});
          c.updateValue('');

          expect(c.errors).toEqual({'required': true});
        });

        it('should update the parent group\'s validity', () => {
          var c = new FormControl('someValue');
          var g = new FormGroup({'one': c});

          expect(g.valid).toEqual(true);

          c.setErrors({'someError': true});

          expect(g.valid).toEqual(false);
        });

        it('should not reset parent\'s errors', () => {
          var c = new FormControl('someValue');
          var g = new FormGroup({'one': c});

          g.setErrors({'someGroupError': true});
          c.setErrors({'someError': true});

          expect(g.errors).toEqual({'someGroupError': true});
        });

        it('should reset errors when updating a value', () => {
          var c = new FormControl('oldValue');
          var g = new FormGroup({'one': c});

          g.setErrors({'someGroupError': true});
          c.setErrors({'someError': true});

          c.updateValue('newValue');

          expect(c.errors).toEqual(null);
          expect(g.errors).toEqual(null);
        });
      });
    });

    describe('FormGroup', () => {
      describe('value', () => {
        it('should be the reduced value of the child controls', () => {
          var g = new FormGroup({'one': new FormControl('111'), 'two': new FormControl('222')});
          expect(g.value).toEqual({'one': '111', 'two': '222'});
        });

        it('should be empty when there are no child controls', () => {
          var g = new FormGroup({});
          expect(g.value).toEqual({});
        });

        it('should support nested groups', () => {
          var g = new FormGroup({
            'one': new FormControl('111'),
            'nested': new FormGroup({'two': new FormControl('222')})
          });
          expect(g.value).toEqual({'one': '111', 'nested': {'two': '222'}});

          (<FormControl>(g.controls['nested'].find('two'))).updateValue('333');

          expect(g.value).toEqual({'one': '111', 'nested': {'two': '333'}});
        });
      });

      describe('adding and removing controls', () => {
        it('should update value and validity when control is added', () => {
          var g = new FormGroup({'one': new FormControl('1')});
          expect(g.value).toEqual({'one': '1'});
          expect(g.valid).toBe(true);

          g.addControl('two', new FormControl('2', Validators.minLength(10)));

          expect(g.value).toEqual({'one': '1', 'two': '2'});
          expect(g.valid).toBe(false);
        });

        it('should update value and validity when control is removed', () => {
          var g = new FormGroup(
              {'one': new FormControl('1'), 'two': new FormControl('2', Validators.minLength(10))});
          expect(g.value).toEqual({'one': '1', 'two': '2'});
          expect(g.valid).toBe(false);

          g.removeControl('two');

          expect(g.value).toEqual({'one': '1'});
          expect(g.valid).toBe(true);
        });
      });

      describe('errors', () => {
        it('should run the validator when the value changes', () => {
          var simpleValidator = (c: any /** TODO #9100 */) =>
              c.controls['one'].value != 'correct' ? {'broken': true} : null;

          var c = new FormControl(null);
          var g = new FormGroup({'one': c}, null, simpleValidator);

          c.updateValue('correct');

          expect(g.valid).toEqual(true);
          expect(g.errors).toEqual(null);

          c.updateValue('incorrect');

          expect(g.valid).toEqual(false);
          expect(g.errors).toEqual({'broken': true});
        });
      });

      describe('dirty', () => {
        var c: any /** TODO #9100 */, g: any /** TODO #9100 */;

        beforeEach(() => {
          c = new FormControl('value');
          g = new FormGroup({'one': c});
        });

        it('should be false after creating a control', () => { expect(g.dirty).toEqual(false); });

        it('should be false after changing the value of the control', () => {
          c.markAsDirty();

          expect(g.dirty).toEqual(true);
        });
      });

      describe('optional components', () => {
        describe('contains', () => {
          var group: any /** TODO #9100 */;

          beforeEach(() => {
            group = new FormGroup(
                {
                  'required': new FormControl('requiredValue'),
                  'optional': new FormControl('optionalValue')
                },
                {'optional': false});
          });

          // rename contains into has
          it('should return false when the component is not included',
             () => { expect(group.contains('optional')).toEqual(false); })

          it('should return false when there is no component with the given name',
             () => { expect(group.contains('something else')).toEqual(false); });

          it('should return true when the component is included', () => {
            expect(group.contains('required')).toEqual(true);

            group.include('optional');

            expect(group.contains('optional')).toEqual(true);
          });
        });

        it('should not include an inactive component into the group value', () => {
          var group = new FormGroup(
              {
                'required': new FormControl('requiredValue'),
                'optional': new FormControl('optionalValue')
              },
              {'optional': false});

          expect(group.value).toEqual({'required': 'requiredValue'});

          group.include('optional');

          expect(group.value).toEqual({'required': 'requiredValue', 'optional': 'optionalValue'});
        });

        it('should not run Validators on an inactive component', () => {
          var group = new FormGroup(
              {
                'required': new FormControl('requiredValue', Validators.required),
                'optional': new FormControl('', Validators.required)
              },
              {'optional': false});

          expect(group.valid).toEqual(true);

          group.include('optional');

          expect(group.valid).toEqual(false);
        });
      });

      describe('valueChanges', () => {
        var g: any /** TODO #9100 */, c1: any /** TODO #9100 */, c2: any /** TODO #9100 */;

        beforeEach(() => {
          c1 = new FormControl('old1');
          c2 = new FormControl('old2');
          g = new FormGroup({'one': c1, 'two': c2}, {'two': true});
        });

        it('should fire an event after the value has been updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             ObservableWrapper.subscribe(g.valueChanges, (value) => {
               expect(g.value).toEqual({'one': 'new1', 'two': 'old2'});
               expect(value).toEqual({'one': 'new1', 'two': 'old2'});
               async.done();
             });
             c1.updateValue('new1');
           }));

        it('should fire an event after the control\'s observable fired an event',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             var controlCallbackIsCalled = false;

             ObservableWrapper.subscribe(
                 c1.valueChanges, (value) => { controlCallbackIsCalled = true; });

             ObservableWrapper.subscribe(g.valueChanges, (value) => {
               expect(controlCallbackIsCalled).toBe(true);
               async.done();
             });

             c1.updateValue('new1');
           }));

        it('should fire an event when a control is excluded',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             ObservableWrapper.subscribe(g.valueChanges, (value) => {
               expect(value).toEqual({'one': 'old1'});
               async.done();
             });

             g.exclude('two');
           }));

        it('should fire an event when a control is included',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             g.exclude('two');

             ObservableWrapper.subscribe(g.valueChanges, (value) => {
               expect(value).toEqual({'one': 'old1', 'two': 'old2'});
               async.done();
             });

             g.include('two');
           }));

        it('should fire an event every time a control is updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             var loggedValues: any[] /** TODO #9100 */ = [];

             ObservableWrapper.subscribe(g.valueChanges, (value) => {
               loggedValues.push(value);

               if (loggedValues.length == 2) {
                 expect(loggedValues).toEqual([
                   {'one': 'new1', 'two': 'old2'}, {'one': 'new1', 'two': 'new2'}
                 ]);
                 async.done();
               }
             });

             c1.updateValue('new1');
             c2.updateValue('new2');
           }));

        xit('should not fire an event when an excluded control is updated',
            inject(
                [AsyncTestCompleter], (async: AsyncTestCompleter) => {
                                          // hard to test without hacking zones
                                      }));
      });

      describe('getError', () => {
        it('should return the error when it is present', () => {
          var c = new FormControl('', Validators.required);
          var g = new FormGroup({'one': c});
          expect(c.getError('required')).toEqual(true);
          expect(g.getError('required', ['one'])).toEqual(true);
        });

        it('should return null otherwise', () => {
          var c = new FormControl('not empty', Validators.required);
          var g = new FormGroup({'one': c});
          expect(c.getError('invalid')).toEqual(null);
          expect(g.getError('required', ['one'])).toEqual(null);
          expect(g.getError('required', ['invalid'])).toEqual(null);
        });
      });

      describe('asyncValidator', () => {
        it('should run the async validator', fakeAsync(() => {
             var c = new FormControl('value');
             var g = new FormGroup({'one': c}, null, null, asyncValidator('expected'));

             expect(g.pending).toEqual(true);

             tick(1);

             expect(g.errors).toEqual({'async': true});
             expect(g.pending).toEqual(false);
           }));

        it('should set the parent group\'s status to pending', fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));
             var g = new FormGroup({'one': c});

             expect(g.pending).toEqual(true);

             tick(1);

             expect(g.pending).toEqual(false);
           }));

        it('should run the parent group\'s async validator when children are pending',
           fakeAsync(() => {
             var c = new FormControl('value', null, asyncValidator('expected'));
             var g = new FormGroup({'one': c}, null, null, asyncValidator('expected'));

             tick(1);

             expect(g.errors).toEqual({'async': true});
             expect(g.find(['one']).errors).toEqual({'async': true});
           }));
      })
    });

    describe('FormArray', () => {
      describe('adding/removing', () => {
        var a: FormArray;
        var c1: any /** TODO #9100 */, c2: any /** TODO #9100 */, c3: any /** TODO #9100 */;

        beforeEach(() => {
          a = new FormArray([]);
          c1 = new FormControl(1);
          c2 = new FormControl(2);
          c3 = new FormControl(3);
        });

        it('should support pushing', () => {
          a.push(c1);
          expect(a.length).toEqual(1);
          expect(a.controls).toEqual([c1]);
        });

        it('should support removing', () => {
          a.push(c1);
          a.push(c2);
          a.push(c3);

          a.removeAt(1);

          expect(a.controls).toEqual([c1, c3]);
        });

        it('should support inserting', () => {
          a.push(c1);
          a.push(c3);

          a.insert(1, c2);

          expect(a.controls).toEqual([c1, c2, c3]);
        });
      });

      describe('value', () => {
        it('should be the reduced value of the child controls', () => {
          var a = new FormArray([new FormControl(1), new FormControl(2)]);
          expect(a.value).toEqual([1, 2]);
        });

        it('should be an empty array when there are no child controls', () => {
          var a = new FormArray([]);
          expect(a.value).toEqual([]);
        });
      });

      describe('errors', () => {
        it('should run the validator when the value changes', () => {
          var simpleValidator = (c: any /** TODO #9100 */) =>
              c.controls[0].value != 'correct' ? {'broken': true} : null;

          var c = new FormControl(null);
          var g = new FormArray([c], simpleValidator);

          c.updateValue('correct');

          expect(g.valid).toEqual(true);
          expect(g.errors).toEqual(null);

          c.updateValue('incorrect');

          expect(g.valid).toEqual(false);
          expect(g.errors).toEqual({'broken': true});
        });
      });


      describe('dirty', () => {
        var c: FormControl;
        var a: FormArray;

        beforeEach(() => {
          c = new FormControl('value');
          a = new FormArray([c]);
        });

        it('should be false after creating a control', () => { expect(a.dirty).toEqual(false); });

        it('should be false after changing the value of the control', () => {
          c.markAsDirty();

          expect(a.dirty).toEqual(true);
        });
      });

      describe('pending', () => {
        var c: FormControl;
        var a: FormArray;

        beforeEach(() => {
          c = new FormControl('value');
          a = new FormArray([c]);
        });

        it('should be false after creating a control', () => {
          expect(c.pending).toEqual(false);
          expect(a.pending).toEqual(false);
        });

        it('should be true after changing the value of the control', () => {
          c.markAsPending();

          expect(c.pending).toEqual(true);
          expect(a.pending).toEqual(true);
        });

        it('should not update the parent when onlySelf = true', () => {
          c.markAsPending({onlySelf: true});

          expect(c.pending).toEqual(true);
          expect(a.pending).toEqual(false);
        });
      });

      describe('valueChanges', () => {
        var a: FormArray;
        var c1: any /** TODO #9100 */, c2: any /** TODO #9100 */;

        beforeEach(() => {
          c1 = new FormControl('old1');
          c2 = new FormControl('old2');
          a = new FormArray([c1, c2]);
        });

        it('should fire an event after the value has been updated',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             ObservableWrapper.subscribe(a.valueChanges, (value) => {
               expect(a.value).toEqual(['new1', 'old2']);
               expect(value).toEqual(['new1', 'old2']);
               async.done();
             });
             c1.updateValue('new1');
           }));

        it('should fire an event after the control\'s observable fired an event',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             var controlCallbackIsCalled = false;

             ObservableWrapper.subscribe(
                 c1.valueChanges, (value) => { controlCallbackIsCalled = true; });

             ObservableWrapper.subscribe(a.valueChanges, (value) => {
               expect(controlCallbackIsCalled).toBe(true);
               async.done();
             });

             c1.updateValue('new1');
           }));

        it('should fire an event when a control is removed',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             ObservableWrapper.subscribe(a.valueChanges, (value) => {
               expect(value).toEqual(['old1']);
               async.done();
             });

             a.removeAt(1);
           }));

        it('should fire an event when a control is added',
           inject([AsyncTestCompleter], (async: AsyncTestCompleter) => {
             a.removeAt(1);

             ObservableWrapper.subscribe(a.valueChanges, (value) => {
               expect(value).toEqual(['old1', 'old2']);
               async.done();
             });

             a.push(c2);
           }));
      });

      describe('find', () => {
        it('should return null when path is null', () => {
          var g = new FormGroup({});
          expect(g.find(null)).toEqual(null);
        });

        it('should return null when path is empty', () => {
          var g = new FormGroup({});
          expect(g.find([])).toEqual(null);
        });

        it('should return null when path is invalid', () => {
          var g = new FormGroup({});
          expect(g.find(['one', 'two'])).toEqual(null);
        });

        it('should return a child of a control group', () => {
          var g = new FormGroup({
            'one': new FormControl('111'),
            'nested': new FormGroup({'two': new FormControl('222')})
          });

          expect(g.find(['nested', 'two']).value).toEqual('222');
          expect(g.find(['one']).value).toEqual('111');
          expect(g.find('nested/two').value).toEqual('222');
          expect(g.find('one').value).toEqual('111');
        });

        it('should return an element of an array', () => {
          var g = new FormGroup({'array': new FormArray([new FormControl('111')])});

          expect(g.find(['array', 0]).value).toEqual('111');
        });
      });

      describe('asyncValidator', () => {
        it('should run the async validator', fakeAsync(() => {
             var c = new FormControl('value');
             var g = new FormArray([c], null, asyncValidator('expected'));

             expect(g.pending).toEqual(true);

             tick(1);

             expect(g.errors).toEqual({'async': true});
             expect(g.pending).toEqual(false);
           }));
      })
    });
  });
}
