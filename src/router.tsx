import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import App from "./App";
import Search from "./pages/Search";
import Feed from "./pages/Feed";
import Library from "./pages/Library";
import Parse from "./pages/Parse";
import Models from "./pages/Models";
import Settings from "./pages/Settings";
import Skills from "./pages/Skills";
import SkillEditor from "./components/SkillEditor";
import Chat from "./pages/Chat";

const rootRoute = createRootRoute({
  component: () => (
    <App>
      <Outlet />
    </App>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/search" });
  },
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: Search,
});

const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feed",
  component: Feed,
});

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  component: Library,
});

const parseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/parse",
  component: Parse,
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/models",
  component: Models,
});

const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: Skills,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: Chat,
});

const skillNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/new",
  component: () => <SkillEditor mode="new" name={null} />,
});

const skillEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/$name/edit",
  component: function SkillEditPage() {
    const { name } = skillEditRoute.useParams();
    return <SkillEditor mode="edit" name={name} />;
  },
});

const skillCopyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/$name/copy",
  component: function SkillCopyPage() {
    const { name } = skillCopyRoute.useParams();
    return <SkillEditor mode="copy" name={name} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  feedRoute,
  libraryRoute,
  parseRoute,
  modelsRoute,
  chatRoute,
  skillsRoute,
  skillNewRoute,
  skillEditRoute,
  skillCopyRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
