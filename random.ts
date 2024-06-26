const NAMES = [
  "Elian",
  "Fernando",
  "Ignacio",
  "Agustina",
];

export function get_random_name() {
  const random_index = random_number_between(0, NAMES.length - 1);
  return NAMES[random_index];
}

const LASTNAMES = [
  "Cordoba",
  "Guevara",
  "Durand",
  "Fernandez",
];

export function get_random_lastname() {
  const random_index = random_number_between(0, LASTNAMES.length - 1);
  return LASTNAMES[random_index];
}

export function random_number_between(min = 1, max = 10) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
