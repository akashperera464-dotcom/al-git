import { handleFactoryRequest } from "../server/factoryProxy";
export default { fetch: (request: Request) => handleFactoryRequest("lorry", request) };
