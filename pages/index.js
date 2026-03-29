export default function Home() {
  return (
    <div style={{ 
      backgroundColor: 'black', 
      color: 'red', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center',
      fontFamily: 'monospace',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem' }}>VOID METAL FORGE</h1>
      <p style={{ fontSize: '1.2rem', color: 'gray' }}>
        The Shepherd Protocol is Active. 3,100 Nodes Online.
      </p>
      <div style={{ 
        marginTop: '20px', 
        padding: '10px 20px', 
        border: '1px solid red',
        cursor: 'pointer'
      }}>
        START THE RITUAL
      </div>
    </div>
  )
}
