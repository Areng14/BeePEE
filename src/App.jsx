import { BrowserRouter, Routes, Route } from "react-router-dom"
import ItemBrowser from "./components/ItemBrowser"
import ItemEditor from "./components/ItemEditor"
import { ItemProvider } from "./contexts/ItemContext"
import "./global.css"

function App() {
    return (
        <ItemProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<ItemBrowser />} />
                    <Route path="/editor" element={<ItemEditor />} />
                </Routes>
            </BrowserRouter>
        </ItemProvider>
    )
}

export default App
