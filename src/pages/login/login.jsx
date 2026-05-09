import { useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/logocoralina.png";
import './Login.css';

export default function Login() {
  const { login, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return alert("Ingresa usuario y contraseña");
    setIsLogging(true);
    const success = await login(username, password);
    setIsLogging(false);
    if (success) navigate("/");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src={logo} alt="Logo" className="login-logo" />
          <h1 className="login-title">LA CORALINA</h1>
          <p className="login-subtitle">Sistema de gestión de pedidos</p>
        </div>
        <div className="login-form">
          <div className="login-input-group">
            <label className="login-label">Usuario</label>
            <input 
              type="text" 
              placeholder="admin" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="login-input" 
              onKeyDown={e => e.key === "Enter" && handleLogin()} 
            />
          </div>
          <div className="login-input-group">
            <label className="login-label">Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="login-input" 
              onKeyDown={e => e.key === "Enter" && handleLogin()} 
            />
          </div>
          <button 
            className="login-button" 
            onClick={handleLogin} 
            disabled={loading || isLogging}
          >
            {isLogging ? "Ingresando..." : "Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}