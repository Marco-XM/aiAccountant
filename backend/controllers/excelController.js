const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Generate random sales data
const generateSalesData = (count = 10000) => {
    const products = [
        'MacBook Pro 16"', 'iPhone 15 Pro', 'Samsung Galaxy S24', 'Dell XPS 13', 'Surface Pro 9',
        'iPad Air', 'Apple Watch Series 9', 'AirPods Pro', 'Sony WH-1000XM5', 'Bose QuietComfort',
        'Canon EOS R6', 'Sony Alpha A7 IV', 'Nintendo Switch', 'PlayStation 5', 'Xbox Series X',
        'LG OLED 65"', 'Samsung 4K Monitor', 'Herman Miller Chair', 'Standing Desk', 'Webcam 4K',
        'Mechanical Keyboard', 'Gaming Mouse', 'External SSD', 'USB-C Hub', 'Wireless Charger',
        'Bluetooth Speaker', 'Smart Watch', 'Fitness Tracker', 'VR Headset', 'Drone Camera',
        'Coffee Machine', 'Air Purifier', 'Smart Thermostat', 'Security Camera', 'Robot Vacuum',
        'Electric Scooter', 'Portable Battery', 'Wireless Earbuds', 'Smart TV 55"', 'Sound Bar'
    ];

    const customers = [
        'Apple Inc.', 'Microsoft Corp.', 'Google LLC', 'Amazon.com Inc.', 'Meta Platforms',
        'Tesla Inc.', 'Netflix Inc.', 'Adobe Inc.', 'Salesforce Inc.', 'Oracle Corp.',
        'IBM Corp.', 'Intel Corp.', 'NVIDIA Corp.', 'AMD Inc.', 'Qualcomm Inc.',
        'Cisco Systems', 'VMware Inc.', 'ServiceNow Inc.', 'Workday Inc.', 'Zoom Video',
        'DocuSign Inc.', 'CrowdStrike Inc.', 'Palantir Technologies', 'Unity Software',
        'Snowflake Inc.', 'Datadog Inc.', 'Okta Inc.', 'Twilio Inc.', 'Square Inc.',
        'PayPal Holdings', 'Shopify Inc.', 'Uber Technologies', 'Lyft Inc.', 'Airbnb Inc.',
        'DoorDash Inc.', 'Robinhood Markets', 'Coinbase Global', 'Peloton Interactive'
    ];

    const salesReps = [
        'John Smith', 'Sarah Connor', 'Mike Johnson', 'Emily Davis', 'David Brown',
        'Jessica Wilson', 'Robert Garcia', 'Ashley Miller', 'Chris Anderson', 'Amanda Taylor',
        'Matthew Thomas', 'Jennifer White', 'Daniel Harris', 'Lisa Clark', 'Kevin Lewis',
        'Rachel Walker', 'Brian Hall', 'Nicole Allen', 'Steven Young', 'Michelle King'
    ];

    const regions = [
        'North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East & Africa'
    ];

    const channels = [
        'Direct Sales', 'Online Store', 'Partner Channel', 'Retail Store', 'Marketplace'
    ];

    const sales = [];
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2024-12-31');

    for (let i = 0; i < count; i++) {
        // Generate random date between start and end date
        const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
        const date = new Date(randomTime);

        // Generate random quantity between 1 and 100
        const quantity = Math.floor(Math.random() * 100) + 1;
        
        // Generate random unit price between $50 and $5000
        const unitPrice = (Math.random() * 4950 + 50).toFixed(2);
        const totalAmount = (quantity * parseFloat(unitPrice)).toFixed(2);
        
        // Generate random discount between 0% and 25%
        const discountPercent = (Math.random() * 25).toFixed(1);
        const discountAmount = (parseFloat(totalAmount) * (parseFloat(discountPercent) / 100)).toFixed(2);
        const finalAmount = (parseFloat(totalAmount) - parseFloat(discountAmount)).toFixed(2);

        const sale = {
            'Sale ID': `SAL${String(i + 1).padStart(6, '0')}`,
            'Date': date.toISOString().split('T')[0],
            'Customer': customers[Math.floor(Math.random() * customers.length)],
            'Product': products[Math.floor(Math.random() * products.length)],
            'Quantity': quantity,
            'Unit Price': parseFloat(unitPrice),
            'Gross Amount': parseFloat(totalAmount),
            'Discount %': parseFloat(discountPercent),
            'Discount Amount': parseFloat(discountAmount),
            'Net Amount': parseFloat(finalAmount),
            'Sales Rep': salesReps[Math.floor(Math.random() * salesReps.length)],
            'Region': regions[Math.floor(Math.random() * regions.length)],
            'Channel': channels[Math.floor(Math.random() * channels.length)],
            'Currency': 'USD',
            'Status': Math.random() > 0.05 ? 'Completed' : (Math.random() > 0.5 ? 'Pending' : 'Cancelled'),
            'Commission %': (Math.random() * 10 + 5).toFixed(1), // 5-15% commission
            'Commission Amount': (parseFloat(finalAmount) * (Math.random() * 0.10 + 0.05)).toFixed(2)
        };

        sales.push(sale);
    }

    return sales;
};

// Generate random expense data
const generateExpenseData = (count = 10000) => {
    const categories = [
        'Office Supplies', 'Travel', 'Meals & Entertainment', 'Software', 'Hardware',
        'Marketing', 'Utilities', 'Rent', 'Insurance', 'Professional Services',
        'Training', 'Equipment', 'Maintenance', 'Fuel', 'Communications',
        'Legal Fees', 'Consulting', 'Advertising', 'Subscriptions', 'Shipping'
    ];

    const vendors = [
        'Amazon Business', 'Microsoft', 'Google', 'Adobe', 'Salesforce',
        'Dell', 'HP', 'Staples', 'FedEx', 'UPS', 'Verizon', 'AT&T',
        'Marriott', 'Hilton', 'Uber', 'Lyft', 'Starbucks', 'McDonald\'s',
        'Best Buy', 'Office Depot', 'Walmart', 'Target', 'Costco'
    ];

    const departments = [
        'Accounting', 'Sales', 'Marketing', 'IT', 'HR', 'Operations',
        'Customer Service', 'R&D', 'Legal', 'Executive'
    ];

    const employees = [
        'John Smith', 'Sarah Johnson', 'Mike Davis', 'Emily Brown', 'David Wilson',
        'Jessica Garcia', 'Robert Miller', 'Ashley Jones', 'Chris Anderson', 'Amanda Taylor',
        'Matthew Thomas', 'Jennifer White', 'Daniel Harris', 'Lisa Clark', 'Kevin Lewis',
        'Rachel Walker', 'Brian Hall', 'Nicole Allen', 'Steven Young', 'Michelle King'
    ];

    const expenses = [];
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2024-12-31');

    for (let i = 0; i < count; i++) {
        // Generate random date between start and end date
        const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
        const date = new Date(randomTime);

        // Generate random amount between $5 and $5000
        const amount = (Math.random() * 4995 + 5).toFixed(2);
        
        const expense = {
            'Expense ID': `EXP${String(i + 1).padStart(6, '0')}`,
            'Date': date.toISOString().split('T')[0],
            'Employee': employees[Math.floor(Math.random() * employees.length)],
            'Department': departments[Math.floor(Math.random() * departments.length)],
            'Category': categories[Math.floor(Math.random() * categories.length)],
            'Vendor': vendors[Math.floor(Math.random() * vendors.length)],
            'Description': generateDescription(categories[Math.floor(Math.random() * categories.length)]),
            'Amount': parseFloat(amount),
            'Currency': 'USD',
            'Status': Math.random() > 0.1 ? 'Approved' : (Math.random() > 0.5 ? 'Pending' : 'Rejected'),
            'Receipt': Math.random() > 0.2 ? 'Yes' : 'No',
            'Reimbursable': Math.random() > 0.3 ? 'Yes' : 'No',
            'Project Code': `PRJ${Math.floor(Math.random() * 100 + 1).toString().padStart(3, '0')}`,
            'Tax Amount': (parseFloat(amount) * (Math.random() * 0.15)).toFixed(2),
            'Payment Method': Math.random() > 0.5 ? 'Corporate Card' : (Math.random() > 0.5 ? 'Personal Card' : 'Cash')
        };

        expenses.push(expense);
    }

    return expenses;
};

// Generate realistic descriptions based on category
const generateDescription = (category) => {
    const descriptions = {
        'Office Supplies': ['Printer ink cartridges', 'Office chairs', 'Desk organizers', 'Notebooks and pens', 'Paper supplies'],
        'Travel': ['Flight to NYC', 'Hotel accommodation', 'Airport parking', 'Car rental', 'Taxi fare'],
        'Meals & Entertainment': ['Client dinner', 'Team lunch', 'Conference catering', 'Coffee meeting', 'Business breakfast'],
        'Software': ['Adobe Creative Suite license', 'Microsoft Office subscription', 'Project management tool', 'Antivirus software', 'Design software'],
        'Hardware': ['Laptop computer', 'Monitor display', 'Wireless mouse', 'External hard drive', 'Webcam'],
        'Marketing': ['Google Ads campaign', 'Trade show booth', 'Marketing materials', 'Social media promotion', 'Website development'],
        'Utilities': ['Electricity bill', 'Internet service', 'Phone service', 'Water bill', 'Gas bill'],
        'Rent': ['Office space rent', 'Storage facility', 'Parking space', 'Equipment rental', 'Conference room'],
        'Insurance': ['Business insurance premium', 'Equipment insurance', 'Liability coverage', 'Health insurance', 'Travel insurance'],
        'Professional Services': ['Legal consultation', 'Accounting services', 'IT support', 'Consulting fees', 'Audit services']
    };

    const categoryDescriptions = descriptions[category] || ['General business expense', 'Miscellaneous cost', 'Business purchase'];
    return categoryDescriptions[Math.floor(Math.random() * categoryDescriptions.length)];
};

// Controller function to generate and download Excel
const generateExpenseExcel = async (req, res) => {
    try {
        const { count = 10000 } = req.query;
        const expenseCount = Math.min(parseInt(count), 50000); // Limit to 50k records

        console.log(`Generating ${expenseCount} expense records...`);
        
        // Generate expense data
        const expenses = generateExpenseData(expenseCount);

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(expenses);

        // Add some styling and formatting
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // Set column widths
        worksheet['!cols'] = [
            { width: 12 }, // Expense ID
            { width: 12 }, // Date
            { width: 15 }, // Employee
            { width: 15 }, // Department
            { width: 20 }, // Category
            { width: 20 }, // Vendor
            { width: 30 }, // Description
            { width: 12 }, // Amount
            { width: 8 },  // Currency
            { width: 10 }, // Status
            { width: 8 },  // Receipt
            { width: 12 }, // Reimbursable
            { width: 12 }, // Project Code
            { width: 12 }, // Tax Amount
            { width: 15 }  // Payment Method
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers for file download
        const filename = `expense_report_${expenseCount}_records_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.length);

        // Send the buffer
        res.send(buffer);

        console.log(`Excel file generated successfully: ${filename}`);

    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({
            error: 'Failed to generate Excel file',
            message: error.message
        });
    }
};

// Controller function to get expense statistics
const getExpenseStats = async (req, res) => {
    try {
        const { count = 1000 } = req.query;
        const expenseCount = Math.min(parseInt(count), 10000);
        
        // Generate smaller dataset for stats
        const expenses = generateExpenseData(expenseCount);
        
        // Calculate statistics
        const totalAmount = expenses.reduce((sum, expense) => sum + expense.Amount, 0);
        const avgAmount = totalAmount / expenses.length;
        
        const categoryStats = expenses.reduce((acc, expense) => {
            if (!acc[expense.Category]) {
                acc[expense.Category] = { count: 0, total: 0 };
            }
            acc[expense.Category].count++;
            acc[expense.Category].total += expense.Amount;
            return acc;
        }, {});

        const departmentStats = expenses.reduce((acc, expense) => {
            if (!acc[expense.Department]) {
                acc[expense.Department] = { count: 0, total: 0 };
            }
            acc[expense.Department].count++;
            acc[expense.Department].total += expense.Amount;
            return acc;
        }, {});

        res.json({
            totalRecords: expenses.length,
            totalAmount: totalAmount.toFixed(2),
            averageAmount: avgAmount.toFixed(2),
            categoryBreakdown: categoryStats,
            departmentBreakdown: departmentStats,
            sampleData: expenses.slice(0, 10) // First 10 records as sample
        });

    } catch (error) {
        console.error('Error generating expense stats:', error);
        res.status(500).json({
            error: 'Failed to generate expense statistics',
            message: error.message
        });
    }
};

// Controller function to generate and download Sales Excel
const generateSalesExcel = async (req, res) => {
    try {
        const { count = 10000 } = req.query;
        const salesCount = Math.min(parseInt(count), 50000); // Limit to 50k records

        console.log(`Generating ${salesCount} sales records...`);
        
        // Generate sales data
        const sales = generateSalesData(salesCount);

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(sales);

        // Add some styling and formatting
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // Set column widths
        worksheet['!cols'] = [
            { width: 12 }, // Sale ID
            { width: 12 }, // Date
            { width: 20 }, // Customer
            { width: 25 }, // Product
            { width: 10 }, // Quantity
            { width: 12 }, // Unit Price
            { width: 15 }, // Gross Amount
            { width: 12 }, // Discount %
            { width: 15 }, // Discount Amount
            { width: 15 }, // Net Amount
            { width: 15 }, // Sales Rep
            { width: 15 }, // Region
            { width: 15 }, // Channel
            { width: 8 },  // Currency
            { width: 12 }, // Status
            { width: 12 }, // Commission %
            { width: 15 }  // Commission Amount
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers for file download
        const filename = `sales_report_${salesCount}_records_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.length);

        // Send the buffer
        res.send(buffer);

        console.log(`Sales Excel file generated successfully: ${filename}`);

    } catch (error) {
        console.error('Error generating Sales Excel file:', error);
        res.status(500).json({
            error: 'Failed to generate Sales Excel file',
            message: error.message
        });
    }
};

// Controller function to get sales statistics
const getSalesStats = async (req, res) => {
    try {
        const { count = 1000 } = req.query;
        const salesCount = Math.min(parseInt(count), 10000);
        
        // Generate smaller dataset for stats
        const sales = generateSalesData(salesCount);
        
        // Calculate statistics
        const totalGrossAmount = sales.reduce((sum, sale) => sum + sale['Gross Amount'], 0);
        const totalNetAmount = sales.reduce((sum, sale) => sum + sale['Net Amount'], 0);
        const totalCommission = sales.reduce((sum, sale) => sum + sale['Commission Amount'], 0);
        const avgSaleAmount = totalNetAmount / sales.length;
        
        const productStats = sales.reduce((acc, sale) => {
            const product = sale.Product;
            if (!acc[product]) {
                acc[product] = { count: 0, totalAmount: 0, totalQuantity: 0 };
            }
            acc[product].count++;
            acc[product].totalAmount += sale['Net Amount'];
            acc[product].totalQuantity += sale.Quantity;
            return acc;
        }, {});

        const regionStats = sales.reduce((acc, sale) => {
            const region = sale.Region;
            if (!acc[region]) {
                acc[region] = { count: 0, totalAmount: 0 };
            }
            acc[region].count++;
            acc[region].totalAmount += sale['Net Amount'];
            return acc;
        }, {});

        const channelStats = sales.reduce((acc, sale) => {
            const channel = sale.Channel;
            if (!acc[channel]) {
                acc[channel] = { count: 0, totalAmount: 0 };
            }
            acc[channel].count++;
            acc[channel].totalAmount += sale['Net Amount'];
            return acc;
        }, {});

        const salesRepStats = sales.reduce((acc, sale) => {
            const rep = sale['Sales Rep'];
            if (!acc[rep]) {
                acc[rep] = { count: 0, totalAmount: 0, totalCommission: 0 };
            }
            acc[rep].count++;
            acc[rep].totalAmount += sale['Net Amount'];
            acc[rep].totalCommission += sale['Commission Amount'];
            return acc;
        }, {});

        res.json({
            totalRecords: sales.length,
            totalGrossAmount: totalGrossAmount.toFixed(2),
            totalNetAmount: totalNetAmount.toFixed(2),
            totalCommission: totalCommission.toFixed(2),
            averageSaleAmount: avgSaleAmount.toFixed(2),
            productBreakdown: productStats,
            regionBreakdown: regionStats,
            channelBreakdown: channelStats,
            salesRepBreakdown: salesRepStats,
            sampleData: sales.slice(0, 10) // First 10 records as sample
        });

    } catch (error) {
        console.error('Error generating sales stats:', error);
        res.status(500).json({
            error: 'Failed to generate sales statistics',
            message: error.message
        });
    }
};

module.exports = {
    generateExpenseExcel,
    getExpenseStats,
    generateSalesExcel,
    getSalesStats
};