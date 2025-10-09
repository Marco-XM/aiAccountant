import React, { useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { AuthContext } from "../../Context/AuthContext";

const Register = () => {
  const [IsLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { SetUserToken } = useContext(AuthContext);

  const scheme = z.object({
    name: z
      .string()
      .min(3, "Name must be at least 3 characters")
      .max(50, "Name must be at most 50 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  async function signup(values) {
    setIsLoading(true);
    try {
      const payload = {
        name: values.name,
        email: values.email,
        password: values.password,
      };
      const { data } = await axios.post("http://localhost:5000/api/auth/register", payload);
      
      if (data.success) {
        toast.success(data.message || "Registration successful");
        // Store token and user data
        SetUserToken(data.token);
        localStorage.setItem("token", data.token);
        // Navigate to home page after successful registration
        navigate("/");
      }
    } catch (e) {
      const errMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Registration failed";
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
      name: "",
      email: "",
      password: "",
    },
    resolver: zodResolver(scheme),
    mode: "onBlur",
  });

  return (
    <section className="my-10 p-10 w-1/2 mx-auto shadow-[0_0_7px_.5px] shadow-blue-400/50">
      <Helmet>
        <title>Register Page</title>
      </Helmet>
      <h1 className="text-center mb-16 text-4xl font-bold">Register</h1>

      <form onSubmit={handleSubmit(signup)}>
        {/* Name */}
        <input
          type="text"
          placeholder="Type Your Name..."
          className="input input-info w-full mb-4"
          {...register("name")}
        />
        {errors?.name && touchedFields?.name && (
          <p className="text-red-500 mb-2">{errors.name.message}</p>
        )}

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
          {IsLoading ? "Loading..." : "Register"}
        </button>
      </form>
    </section>
  );
};

export default Register;
