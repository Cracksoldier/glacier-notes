# GlacierNotes

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Backup format

Glacier Notes exports portable `.glacier.json` files. The stable schema-v1 envelope contains
`format`, `schemaVersion`, `exportedAt`, `notebooks`, `notes`, `labels`, and base64-encoded
`images`. New exports also include `scope` (`all`, `notebook`, or `note`) and include
`defaultNotebookId` for full backups. These two fields are optional so exports created by
earlier v1 builds remain importable.

Imports validate every entity and reference before changing local data. When IDs collide,
choose **Add as copies** to remap all IDs safely or **Replace existing** to overwrite matching
IDs. Collision-free imports preserve their original IDs. Importing a full backup into a
pristine installation restores the exported default notebook and removes the generated empty
one. Interrupted imports are rolled back automatically the next time the app starts.
