# US school list

`usSchools.json` holds every K-12 school in the United States: about 100,000
public schools and 22,000 private schools. The sign-up pages search it so a
teacher or student can find their school by name.

- **Where it comes from:** the National Center for Education Statistics (NCES).
  Public schools are from the Common Core of Data, school year 2024-25.
  Private schools are from the Private School Survey, 2023-24.
- **Compiled by:** the SchoolData project, https://github.com/bxshan/SchoolData
- **Licence:** Creative Commons Attribution-ShareAlike 4.0,
  https://creativecommons.org/licenses/by-sa/4.0/
- **What was changed:** only the name, city, state and grade span are kept.
  Names written in capitals were re-cased ("LINCOLN HS" to "Lincoln HS"), and
  entries with the same name in the same town were merged.

## Updating it

Get a newer `schools.json` from the SchoolData project, then run:

    node script/buildSchoolDirectory.mjs path/to/schools.json "public schools 2025-26, private schools 2023-24"

A school that is missing from the list can still be added by its teacher at
sign-up ("My school isn't listed").
