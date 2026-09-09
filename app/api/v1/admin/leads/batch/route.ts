// The explicit batch path is kept alongside POST /admin/leads for clients
// that prefer a resource-shaped endpoint.  Both paths share auth, validation,
// URL reuse and transaction semantics.
export { POST } from '../route';
