import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import Dashboard from "./features/dashboard/Dashboard";

function App() {
	return (
		<ThemeProvider>
			<Router>
				<Routes>
					<Route path="/" element={<Dashboard />} />
				</Routes>
			</Router>
		</ThemeProvider>
	);
}

export default App;
