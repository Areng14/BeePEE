import './App.css'

function App() {
  const loadPackage = async () => {
    if (window.package) {
      const result = await window.package.loadpackage();
      console.log(result);
    }
  }

  return (
    <>
      <button onClick={loadPackage}>Load Package</button>
    </>
  )
}

export default App