import mysql from "mysql2/promise";
import * as schema from "./schema";
export declare const db: import("drizzle-orm/mysql2").MySql2Database<typeof schema> & {
    $client: mysql.Pool;
};
export * from "./schema";
//# sourceMappingURL=index.d.ts.map