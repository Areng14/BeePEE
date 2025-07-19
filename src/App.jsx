import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ItemBrowser from './components/ItemBrowser'
import ItemEditor from './components/ItemEditor'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<ItemBrowser />} />
                <Route path="/edit/:itemId" element={<ItemEditor />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App