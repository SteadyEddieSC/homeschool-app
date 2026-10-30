# Third-party notices — v11 scheduling

## School Desk (`mblayman/homeschool`)

Learning Harbor's `schedule-forecast` domain behavior was informed by scheduling and reverse-planning semantics from School Desk at frozen upstream commit:

`3becaa83887b94b116ea2be2bb784a65783a3095`

Materially consulted upstream files:

- `homeschool/students/models.py` — ordered incomplete-task selection, current/future week roll-forward, actual coursework dates, and future-year scheduling boundaries;
- `homeschool/courses/models.py` — course meeting-day, task order, duration, and resource semantics;
- `homeschool/schools/models.py` — school-year, global/learner break, and valid-day/task-count semantics;
- `homeschool/core/tests/test_views.py`, `homeschool/students/tests/test_models.py`, and `homeschool/schools/tests/test_models.py` — future-year, break, roll-forward, completion-history, and schedule edge cases.

Learning Harbor does not include School Desk's Django models, database queries, templates, or runtime. The implementation is a provider-neutral TypeScript adaptation under Learning Harbor's household-first authority model.

The upstream repository is licensed under the MIT License:

> MIT License
>
> Copyright (c) 2019 Matt Layman
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
