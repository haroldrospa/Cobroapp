import React, { useState } from 'react';
import { Plus, Search, Edit, User, Shield, CheckCircle, XCircle } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEmployees, Employee, useManageEmployee } from '@/hooks/useEmployees';
import { EmployeeDialog } from '@/components/employees/EmployeeDialog';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';

const Employees: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const { data: employees = [], isLoading } = useEmployees();
    const { mutate: manageEmployee } = useManageEmployee();
    const { profile, loading: profileLoading } = useUserProfile();
    const navigate = useNavigate();

    console.log('[EMPLOYEES] Loading:', isLoading, 'Employees:', employees, 'Count:', employees.length);

    /* 
    React.useEffect(() => {
        if (!profileLoading && profile?.role && profile.role !== 'admin' && profile.role !== 'manager') {
            navigate('/');
        }
    }, [profile, profileLoading, navigate]);
    */

    const filteredEmployees = employees.filter(employee =>
        employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (employee: Employee) => {
        setSelectedEmployee(employee);
        setDialogOpen(true);
    };

    const handleCreate = () => {
        setSelectedEmployee(null);
        setDialogOpen(true);
    };

    const handleToggleStatus = (employee: Employee) => {
        manageEmployee({
            action: 'toggle_status',
            id: employee.id,
            isActive: !employee.is_active
        });
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge variant="default" className="bg-purple-500">Administrador</Badge>;
            case 'manager':
                return <Badge variant="default" className="bg-blue-500">Gerente</Badge>;
            case 'cashier':
            case 'staff':
                return <Badge variant="default" className="bg-green-500">Cajero</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Empleados</h1>
                    <p className="text-muted-foreground">Administra el acceso y roles de tu equipo</p>
                </div>
                <Button onClick={handleCreate} className="bg-primary">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Empleado
                </Button>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o correo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Correo</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8">
                                        <div className="flex justify-center items-center">
                                            <LoadingLogo size="sm" text="Cargando empleados..." />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredEmployees.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No se encontraron empleados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredEmployees.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {employee.full_name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{employee.email}</TableCell>
                                        <TableCell>{getRoleBadge(employee.role)}</TableCell>
                                        <TableCell>
                                            {employee.is_active ? (
                                                <div className="flex items-center text-green-600 gap-1 text-sm font-medium">
                                                    <CheckCircle className="h-4 w-4" /> Activo
                                                </div>
                                            ) : (
                                                <div className="flex items-center text-red-500 gap-1 text-sm font-medium">
                                                    <XCircle className="h-4 w-4" /> Inactivo
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleStatus(employee)}
                                                    title={employee.is_active ? "Desactivar" : "Activar"}
                                                    className={employee.is_active ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"}
                                                >
                                                    {employee.is_active ? "Desactivar" : "Activar"}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(employee)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <EmployeeDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                employee={selectedEmployee}
            />
        </div>
    );
};

export default Employees;
