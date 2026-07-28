import { getChatGPTUser } from "./chatgpt-auth";
import { InfoHubApp } from "./infohub-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <InfoHubApp user={user} />;
}
