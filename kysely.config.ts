import { defineConfig } from 'kysely-ctl';

import { kysely } from './src/lib/db';

export default defineConfig({
	kysely,
	migrations: {
		migrationFolder: 'migrations'
	}
});
