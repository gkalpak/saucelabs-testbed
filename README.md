# SauceLabs Testbed


## Description

A testbed project to play around with SauceLabs stuff.


## Usage


### General usage

Use the project as a testbed (use different browsers, write custom tests, etc.).
Once you want to discard the changes and return to a pristine state, run `npm run reset`.


### Re-defining pristine state

If you want to define a new pristine state:

1. Create a commit with the changes you want.
2. Push the commit to the remote repository (`origin`).
3. Run `npm run retag`.


### Available commands

The following commands are available for playing around with SauceLabs:

- `node . --demo-local/-l`

  Start SauceConnect and a local server, launch a browser and run a simple test on a local URL.

- `node . --demo-remote/-r`

  Start SauceConnect, launch a browser and run a simple test on a remote URL.

- `node . --sauce-connect/-t`

  Start SauceConnect.
  This is useful if you want to run some tests that require an active SauceConnect tunnel.

- `node . --server/-s`

  Start a local server that serves white-listed files from the [public/](./public) directory.
  This is used internally by the `--demo-local` command.


## TODO

Things I want to (but won't necessarily) do:

- N/A
