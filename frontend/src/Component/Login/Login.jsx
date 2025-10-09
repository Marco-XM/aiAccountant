import React, { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";
import { Helmet } from "react-helmet";

const Login = () => {
  const { SetUserToken } = useContext(AuthContext);

  const [IsLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const scheme = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  async function signup(values) {
    setIsLoading(true);
    try {
      const payload = {
        email: values.email,
        password: values.password,
      };
      const { data } = await axios.post(
        "http://localhost:5000/api/auth/login",
        payload
      );
      
      if (data.success) {
        toast.success("Login successful");
        SetUserToken(data.token);
        localStorage.setItem("token", data.token);
        navigate("/");
      }
    } catch (e) {
      const errMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Login failed";
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  }
  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(scheme),
    mode: "onBlur",
  });

  return (
    <section className="my-10 p-10 w-1/2 mx-auto shadow-[0_0_7px_.5px] shadow-blue-400/50">
      <Helmet>
        <title>Login Page</title>
      </Helmet>
      <h1 className="text-center mb-16 text-4xl font-bold">Login Now</h1>

      <form onSubmit={handleSubmit(signup)}>
        {/* Email */}
        <input
          type="email"
          placeholder="Type Your Email..."
          className="input input-info w-full mb-4"
          {...register("email")}
        />
        {errors?.email && touchedFields?.email && (
          <p className="text-red-500 mb-2">{errors.email.message}</p>
        )}

        {/* Password */}
        <input
          type="password"
          placeholder="Enter Your Password..."
          className="input input-info w-full mb-4"
          {...register("password")}
        />
        {errors?.password && touchedFields?.password && (
          <p className="text-red-500 mb-2">{errors.password.message}</p>
        )}
        <button type="submit" className="btn btn-primary w-full">
          {IsLoading ? (
            <i className="fa-solid fa-spinner fa-spin text-white"></i>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </section>
  );
};

export default Login;
