// Fachada do domínio de carreira (mantém os imports existentes estáveis).
export {
  MAX_CAREERS,
  canAccessLeague,
  countUserCareers,
  deleteCareer,
  getCareer,
  getMembers,
  listCareers,
  listLeagues,
  type CareerContext,
} from "./context";
export { createCareer, joinCareer, openClubs } from "./setup";
export { getUserFixture, playRound, saveTactics, setReady, startUserMatch } from "./matchday";
export { startNewSeason } from "./season";
