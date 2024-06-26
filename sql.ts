import { Client } from "@bartlomieju/postgres";
import {
  get_random_lastname,
  get_random_name,
  random_number_between,
} from "./random.ts";

let _client: Client;

export async function get_client() {
  if (!_client) {
    const client = new Client({
      user: "postgres",
      database: "boats",
      hostname: "127.0.0.1",
      port: 5432,
      password: "",
    });

    await client.connect();

    _client = client;
  }

  return _client;
}
const client = await get_client();

if (import.meta.main) {
  await initialize_db();
  await seed_db();
  // await log_rows('users', `select * from users`)
  // await log_rows("reservations");
  const { rows } = await client.queryArray(`
    select * from reservations r inner join users u on r.user_id = u.id
  `);

  console.table(rows);
}

async function initialize_db() {
  await client.queryArray(`
    DROP TABLE IF EXISTS plans, users, reservations CASCADE;

    CREATE TABLE plans (
      id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name VARCHAR(50) UNIQUE NOT NULL,
      monthly_cost NUMERIC NOT NULL,
      number_of_boats INT NOT NULL CHECK (number_of_boats > 0)
    );

    CREATE TABLE users (
      id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      plan_id INT NOT NULL REFERENCES plans(id)
    );

    CREATE TABLE reservations (
      id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id INT NOT NULL REFERENCES users(id),
      reservation_date DATE NOT NULL, 
	    CONSTRAINT one_reservation_per_day_per_user UNIQUE(user_id, reservation_date)
    );
  `);
}

async function seed_db() {
  await create_plans();
  await create_users();
  await create_reservations();
}

function create_plans() {
  return client.queryArray(`
    INSERT INTO plans VALUES 
      (default, 'Plan simple', 100, 3),
      (default, 'Plan super', 150, 5),
      (default, 'Plan premium', 200, 10)
    `);
}

export async function create_users(number_of_users_to_create = 20) {
  const number_of_plans = await get_number_of_rows("plans");

  let query = "INSERT INTO users VALUES";
  for (let i = 0; i < number_of_users_to_create; i++) {
    const name = get_random_name();
    const lastname = get_random_lastname();
    const plan_id = random_number_between(1, number_of_plans);

    query += ` (default, '${name}', '${lastname}', ${plan_id}),`;
  }

  // Remove trailing comma
  query = query.replace(/.$/, "");

  return client.queryArray(query);
}

async function create_reservations(number_of_reservations_to_create = 100) {
  const number_of_users = await get_number_of_rows("users");
  const plans = (await client.queryArray(`SELECT * FROM plans`)).rows;

  let _current_user_id = 0;
  function get_next_user_id() {
    _current_user_id++;

    if (_current_user_id > number_of_users) {
      _current_user_id = 1;
    }

    return _current_user_id;
  }

  let query = "INSERT INTO reservations VALUES";

  let inserted_rows = 0;
  let iteration = 0;
  const MAX_LOOP_ITERS = 1000;
  insertion_loop: while (iteration < MAX_LOOP_ITERS) {
    iteration++;

    const get_date = date_generator();
    for (let plan_i = 0; plan_i < plans.length; plan_i++) {
      const current_plan = plans[plan_i] as any;

      // Number of boats
      for (let x = 0; x < current_plan[3]; x++) {
        inserted_rows++;
        if (inserted_rows > number_of_reservations_to_create) {
          break insertion_loop;
        }

        const user_id = get_next_user_id();
        const date = get_date.next().value;

        query += `(default, ${user_id}, '${date}'),`;
      }
    }
  }

  // Remove trailing comma
  query = query.replace(/.$/, "");

  await client.queryArray(query);
}

// Utils

async function get_number_of_rows(table_name: string): Promise<number> {
  const { rows } = await client.queryArray(
    `SELECT COUNT(*) FROM ${table_name}`,
  );

  // Count row get's parsed as bigint, so we cast it to number before returning
  const parsed_result = Number(rows[0]);
  return parsed_result;
}

export async function get_columns_from_table(table_name: string) {
  const { rows } = await client.queryArray(
    `SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = '${table_name}'`,
  );

  return rows;
}

async function log_rows(
  table_name: string,
  query = `SELECT * FROM ${table_name}`,
) {
  const columns = await get_columns_from_table(table_name);
  const { rows } = await client.queryArray(query);

  // Rows formats it's the following
  // [
  //   [ 1, "Elian", "Cordoba", 1 ],
  //   [ 2, "Agustina", "Fernandez", 2 ],
  //   ...
  // ]
  //
  // It gets transformed into the following format so that console.table can pick it up
  // [
  //   { id: 1, first_name: "Elian", last_name: "Cordoba", plan_id: 1 },
  //   { id: 2, first_name: "Agustina", last_name: "Fernandez", plan_id: 2 },
  //   ...
  // ]
  const parsed_rows = rows.map((row) => {
    const obj: Record<string, any> = {};
    row.map((column_value, i) => {
      const column_name = columns[i] as any;
      obj[column_name] = column_value;
    });
    return obj;
  });

  console.table(parsed_rows);
}

function* date_generator() {
  let current_day = 1;
  let current_month = 1;
  let current_year = 2024;

  while (true) {
    yield `${current_year}-${current_month}-${current_day}`;

    current_day++;
    if (current_day > 28) {
      current_day = 1;

      current_month++;
      if (current_month > 12) {
        current_month = 1;

        current_year++;
      }
    }
  }
}
